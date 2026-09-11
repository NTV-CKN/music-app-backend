/**
 * Luồng gợi ý được tách thành hai lần gọi AI vì mỗi lần có một nhiệm vụ riêng.
 * Lần đầu AI đọc yêu cầu của người dùng và trả về kết quả phân tích theo schema
 * đầu vào, trong đó có thể loại, khoảng năng lượng và mức độ tin cậy. Các giá trị
 * này được dùng làm tham số để truy vấn danh sách bài hát phù hợp trong Firestore.
 *
 * Sau khi có danh sách ứng viên, lần gọi AI thứ hai nhận yêu cầu ban đầu cùng dữ
 * liệu vừa lấy được và chỉ chọn ra các songId phù hợp nhất. Schema của lần này
 * khác lần đầu vì nó phục vụ việc tạo lời nhắn, tóm tắt yêu cầu và danh sách bài
 * hát được đề xuất. Cách tách này giúp AI không tự bịa thông tin bài hát và đảm
 * bảo kết quả cuối cùng chỉ đến từ dữ liệu đang có trong hệ thống.
 */
const admin = require("firebase-admin");
const {GoogleGenAI, Type} = require("@google/genai");
const {Genre} = require("../../genreSong");

const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});

const supportedGenres = Object.values(Genre);

const unsupportedMessage = "Tôi chưa có đủ thông tin để tìm bài hát phù hợp. " +
    "Bạn hãy nhập một thể loại trong danh sách được hỗ trợ hoặc mô tả rõ tâm trạng của bạn.";

const analysisSchema = {
    type: Type.OBJECT,
    properties: {
        supported: {type: Type.BOOLEAN},
        intent: {type: Type.STRING, enum: ["GENRE", "MOOD", "UNSUPPORTED"]},
        genre: {type: Type.STRING},
        minEnergy: {type: Type.NUMBER},
        maxEnergy: {type: Type.NUMBER},
        confidence: {type: Type.NUMBER},
        evidence: {type: Type.STRING}
    },
    required: ["supported", "intent", "genre", "minEnergy", "maxEnergy", "confidence", "evidence"]
};

//Structured Output
const recommendationSchema = {
    type: Type.OBJECT,
    properties: {
        aiMessage: {
            type: Type.STRING,
            description: `Lời nhắn an ủi, động viên hoặc chúc mừng ngắn gọn (1-2 câu) dựa theo mood của user.
      Trong trường hợp không tìm thấy bất kì bài hát nào phù hợp hoặc dữ liệu của các bài hát không có
       hoặc câu lệnh người dùng không phù hợp với chức năng tìm bài hát theo
        tâm trạng thì hãy bảo người dùng nhập lại theo chủ đề tâm trạng.`
        },
        promptSummary: {
            type: Type.STRING,
            description: "Tóm tắt ngắn chủ đề yêu cầu của user (vd: 'Nhạc thư giãn đêm khuya')."
        },
        recommendedSongIds: {
            type: Type.ARRAY,
            items: {type: Type.STRING},
            description: "Mảng chứa tối đa 10 songId phù hợp nhất. Nếu không có bất kì songId nào thì để rỗng"
        }
    },
    required: ["aiMessage", "promptSummary", "recommendedSongIds"]
};

class AIRecommendationService {
    async callWithRetry(fn, retries = 3, delay = 1000) {
        for (let i = 0; i < retries; i++) {
            try {
                return await fn();
            } catch (error) {
                if (error.message?.includes("high demand") || error.status === 503) {
                    if (i === retries - 1) throw error;
                    await new Promise((res) => setTimeout(res, delay * (i + 1)));
                } else {
                    throw error;
                }
            }
        }
    }

    async _searchSongsInDatabase({genre, minEnergy, maxEnergy, limit = 20}) {
        try {
            const songsRef = admin.firestore().collection("songs");
            let songsQuery = songsRef;

            if (genre) songsQuery = songsQuery.where("genre", "==", genre);
            if (typeof minEnergy === "number") {
                songsQuery = songsQuery.where("energy", ">=", minEnergy);
            }
            if (typeof maxEnergy === "number") {
                songsQuery = songsQuery.where("energy", "<=", maxEnergy);
            }

            const songsSnapshot = await songsQuery.limit(limit).get();

            return songsSnapshot.docs.map((songSnap) => {
                const data = songSnap.data();
                return {
                    songId: data.id || songSnap.id,
                    id: data.id || songSnap.id,
                    title: data.title || "",
                    album: data.album || "",
                    artistId: Number(data.artistId) || 0,
                    artist: data.artist || "",
                    source: data.source || "",
                    image: data.image || "",
                    duration: Number(data.duration) || 0,
                    favorite: Boolean(data.favorite),
                    counter: Number(data.counter) || 0,
                    replay: Number(data.replay) || 0,
                    isVip: Boolean(data.isVip),
                    genre: data.genre || "",
                    energy: data.energy ?? 0.5
                };
            });
        } catch (error) {
            console.log(error);

            return {
                err: error.message
            };
        }
    }

    async _analyzePrompt(userPrompt) {
        const analysisInstruction = `Bạn là bộ phân tích đầu vào cho hệ thống gợi ý nhạc.
        Chỉ đánh dấu supported=true khi câu người dùng có căn cứ rõ ràng để tìm nhạc.
        Có hai trường hợp hợp lệ:
        1. GENRE: người dùng nêu thể loại hoặc từ đồng nghĩa gần nghĩa rõ ràng. Map về đúng một giá trị:
        ${supportedGenres.join(", ")}.
        2. MOOD: người dùng mô tả cảm xúc/tâm trạng có thể suy ra mức năng lượng.
        Quy đổi minEnergy và maxEnergy trong khoảng 0 đến 1.
        Ví dụ vui/sôi động -> năng lượng cao; buồn/chia tay -> thấp; vô vị/nhàm chán -> thấp đến trung bình.
        Không được tự bịa căn cứ từ câu nói mơ hồ, quảng cáo, câu hỏi ngoài chủ đề hoặc nội dung không liên quan.
        Khi không đủ căn cứ: supported=false, intent=UNSUPPORTED, genre="", evidence="".
        evidence phải trích dẫn ngắn gọn từ chính câu người dùng, không được bịa thêm.`;

        const response = await this.callWithRetry(() => ai.models.generateContent({
            model: process.env.MODEL_AI,
            contents: [{role: "user", parts: [{text: userPrompt}]}],
            config: {
                systemInstruction: analysisInstruction,
                responseMimeType: "application/json",
                responseSchema: analysisSchema,
                temperature: 0
            }
        }));

        return JSON.parse(response.text);
    }

    _validateAnalysis(analysis) {
        if (!analysis || analysis.supported !== true ||
            !["GENRE", "MOOD"].includes(analysis.intent) ||
            Number(analysis.confidence) < 0.65 ||
            typeof analysis.evidence !== "string" || !analysis.evidence.trim()) {
            return false;
        }

        const minEnergy = Number(analysis.minEnergy);
        const maxEnergy = Number(analysis.maxEnergy);
        if (!Number.isFinite(minEnergy) || !Number.isFinite(maxEnergy) ||
            minEnergy < 0 || maxEnergy > 1 || minEnergy > maxEnergy) {
            return false;
        }

        if (analysis.intent === "GENRE" && !supportedGenres.includes(analysis.genre)) {
            return false;
        }

        if (analysis.intent === "MOOD" && analysis.genre &&
            !supportedGenres.includes(analysis.genre)) {
            return false;
        }

        return true;
    }

    async getAIHomeRecommendation(userPrompt) {
        try {
            if (typeof userPrompt !== "string" || !userPrompt.trim()) {
                return {
                    aiMessage: "Vui lòng mô tả thể loại hoặc tâm trạng bạn muốn nghe.",
                    promptSummary: "",
                    songs: []
                };
            }

            const systemInstruction = `Bạn là trợ lý âm nhạc AI thông minh của Nguyễn Trường Vũ.
                Chỉ chọn bài hát từ danh sách ứng viên được cung cấp, không được tự bịa songId.
                Nếu danh sách rỗng, phải nói rõ không tìm thấy bài phù hợp.`;

            const analysis = await this._analyzePrompt(userPrompt.trim());
            if (!this._validateAnalysis(analysis)) {
                return {aiMessage: unsupportedMessage, promptSummary: "", songs: []};
            }

            const toolArgs = {
                genre: analysis.genre || "",
                minEnergy: Number(analysis.minEnergy),
                maxEnergy: Number(analysis.maxEnergy),
                limit: 20
            };
            const toolResult = await this._searchSongsInDatabase(toolArgs);
            if (!Array.isArray(toolResult) || toolResult.length === 0) {
                return {
                    aiMessage: "Không tìm thấy bài hát phù hợp với yêu cầu này.",
                    promptSummary: analysis.evidence,
                    songs: []
                };
            }

            const response = await this.callWithRetry(() => ai.models.generateContent({
                model: process.env.MODEL_AI,
                contents: [{
                    role: "user",
                    parts: [{text: JSON.stringify({userPrompt, analysis, candidates: toolResult})}]
                }],
                config: {
                    systemInstruction,
                    responseMimeType: "application/json",
                    responseSchema: recommendationSchema,
                    temperature: 0
                }
            }));

            const parsedResult = JSON.parse(response.text);

            const candidateMap = new Map(toolResult.map((song) => [song.songId, song]));
            const songIds = Array.isArray(parsedResult.recommendedSongIds) ?
                parsedResult.recommendedSongIds : [];
            const fullSongs = songIds
                .map((id) => candidateMap.get(id))
                .filter(Boolean)
                .map(({songId, ...song}) => song);

            return {
                aiMessage: parsedResult.aiMessage || "Đây là những bài hát phù hợp với bạn.",
                promptSummary: parsedResult.promptSummary || analysis.evidence,
                songs: fullSongs
            };
        } catch (error) {
            console.error("Lỗi getAIHomeRecommendation:", error.message, error);

            const isOverload = error.status === 503 ||
                error.message?.includes("high demand") ||
                error.message?.includes("overloaded");

            return {
                aiMessage: isOverload ?
                    "Hệ thống AI đang quá tải, vui lòng thử lại sau ít phút." :
                    "Có lỗi xảy ra, vui lòng thử lại.",
                promptSummary: "",
                songs: []
            };
        }
    }
}

module.exports = new AIRecommendationService();
