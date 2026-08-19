const admin = require("firebase-admin");
const { GoogleGenAI, Type } = require("@google/genai");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const searchSongsInDatabase = "searchSongsInDatabase";

//Mô tả function
const searchSongsDeclaration = {
    name: searchSongsInDatabase,
    description: "Tìm kiếm danh sách bài hát trong Firestore dựa theo thể loại (genre) và chỉ số năng lượng (energy).",
    parameters: {
        type: Type.OBJECT,
        properties: {
            genre: {
                type: Type.STRING, description: `Chỉ nhận đúng 1 trong các thể loại: BALLAD | LOFI
         | ACOUSTIC | POP | INDIE | HIPHOP_RAP | EDM_DANCE | REMIX | ROCK | BOLERO. Nếu người dùng không nêu 
         rõ nhưng có thể suy ra thể loại phù hợp thì phải map về 1 trong các giá trị trên.` },
            minEnergy: { type: Type.NUMBER, description: "Mức năng lượng tối thiểu (0.0 - 1.0)" },
            maxEnergy: { type: Type.NUMBER, description: "Mức năng lượng tối đa (0.0 - 1.0)" },
            limit: { type: Type.NUMBER, description: "Số lượng bài hát tối đa lấy ra từ DB (mặc định 20 - Tối đa 50)" }
        }
    }
};

//Structured Output
const recommendationSchema = {
    type: Type.OBJECT,
    properties: {
        aiMessage: {
            type: Type.STRING,
            description: `Lời nhắn an ủi, động viên hoặc chúc mừng ngắn gọn (1-2 câu) dựa theo mood của user.
      Trong trường hợp không tìm thấy bất kì bài hát nào phù hợp hoặc câu lệnh người dùng không phù hợp với chức
      năng tìm bài hát theo tâm trạng thì hãy bảo thử lại.`
        },
        promptSummary: {
            type: Type.STRING,
            description: "Tóm tắt ngắn chủ đề yêu cầu của user (vd: 'Nhạc thư giãn đêm khuya')."
        },
        recommendedSongIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Mảng chứa tối đa 10 songId phù hợp nhất. Nếu không có bất kì songId nào thì để rỗng"
        }
    },
    required: ["aiMessage", "promptSummary", "recommendedSongIds"]
};

class AIRecommendationService {
    async _searchSongsInDatabase({ genre, minEnergy, maxEnergy, limit = 20 }) {
        try {
            const songsRef = admin.firestore().collection("songs");
            const songsSnapshot = await songsRef
                .where("genre", "==", genre)
                .where("energy", ">=", minEnergy)
                .where("energy", "<=", maxEnergy)
                .limit(limit)
                .get();

            return songsSnapshot.docs.map((songSnap) => {
                const data = songSnap.data();
                return {
                    songId: data.id,
                    title: data.title || "",
                    artist: data.artist || "",
                    genre: data.genre || "",
                    energy: data.energy ?? 0.5
                };
            });
        } catch (error) {
            return {
                err: error.message
            };
        }
    }

    async getAIHomeRecommendation(userPrompt) {
        try {
            if (!userPrompt) throw new Error("Vui lòng viết lệnh");

            const systemInstruction = `Bạn là trợ lý âm nhạc AI thông minh của Nguyễn Trường Vũ.
                Nhiệm vụ:
                1. Phân tích tâm trạng/yêu cầu của người dùng.
                2. BẮT BUỘC gọi tool 'searchSongsInDatabase' để tìm các bài hát ứng viên trong DB.
                3. Dựa trên danh sách nhận được từ tool, chọn tối đa 10 bài phù hợp nhất và trả về 
                JSON đúng cấu trúc yêu cầu.`;

            const contents = [{ role: "user", parts: [{ text: userPrompt }] }];

            //Tạo yêu cầu cho AI phân tích + yêu cầu gọi hàm
            let response = await ai.models.generateContent({
                model: process.env.MODEL_AI,
                contents: contents,
                config: {
                    systemInstruction,
                    tools: [{ functionDeclarations: [searchSongsDeclaration] }]
                }
            });

            //Kiểm tra và lấy các args để tiến hành gọi hàm bóc tách dữ liệu
            const functionCalls = response.functionCalls;
            if (functionCalls && functionCalls.length > 0) {
                const call = functionCalls[0];

                if (call.name === searchSongsInDatabase) {
                    const toolResult = await this._searchSongsInDatabase(call.args);

                    //Bổ sung ngữ cảnh cho lần gọi tiếp theo
                    contents.push(response.candidates[0].content);
                    contents.push({
                        role: "user",
                        parts: [{
                            functionResponse: {
                                name: "searchSongsInDatabase",
                                response: { result: toolResult }
                            }
                        }]
                    });

                    //Sau khi chạy lần đầu, tiến hành yêu cầu AI trích xuất để trả kết quả
                    response = await ai.models.generateContent({
                        model: process.env.MODEL_AI,
                        contents: contents,
                        config: {
                            systemInstruction,
                            responseMimeType: "application/json",
                            responseSchema: recommendationSchema
                        }
                    });
                } else {
                    response = await ai.models.generateContent({
                        model: process.env.MODEL_AI,
                        contents: contents,
                        config: {
                            systemInstruction,
                            responseMimeType: "application/json",
                            responseSchema: recommendationSchema
                        }
                    });
                }
            }

            const parsedResult = JSON.parse(response.text);

            //Lấy ra các song data từ songIds
            let fullSongs = [];
            const songIds = parsedResult.recommendedSongIds || [];

            if (songIds.length > 0) {
                const songsSnap = await admin.firestore()
                    .collection("songs")
                    .where("id", "in", songIds)
                    .get();

                const songMap = new Map();
                songsSnap.docs.forEach((doc) => {
                    songMap.set(doc.id, { ...doc.data() });
                });

                fullSongs = songIds.map((id) => songMap.get(id)).filter(Boolean);
            }

            console.log("sss", songIds);

            //Trả về structured output
            return {
                aiMessage: parsedResult.aiMessage,
                promptSummary: parsedResult.promptSummary,
                songs: fullSongs
            };
        } catch (error) {
            return {
                aiMessage: error.message,
                promptSummary: "",
                songs: []
            };
        }
    }
}

module.exports = new AIRecommendationService();