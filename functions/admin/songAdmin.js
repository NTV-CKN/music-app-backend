const admin = require("firebase-admin");
const { Genre } = require("../genreSong");
const { FieldValue } = require("firebase-admin/firestore");

const bucket = admin.storage().bucket();

const getSongsPaging = async (req, res) => {
    try {
        const searchQuery = req.query.query || "";
        const limit = parseInt(req.query.limit, 10) || 20;
        const pageKey = parseInt(req.query.key, 10) || 0;
        const offset = pageKey * limit;

        let songsQuery = admin.firestore().collection("songs");
        let words;

        if (searchQuery !== "") {
            const strFrontCode = searchQuery;
            const strEndCode = searchQuery + "\uf8ff";

            songsQuery = songsQuery
                .where('title', '>=', strFrontCode)
                .where('title', '<=', strEndCode);
        }

        const songsSnap = await songsQuery
            .limit(limit)
            .offset(offset)
            .get();



        const songs = songsSnap.docs.map(song => ({
            ...song.data(),
        }));

        return res.status(200).json({
            songs: songs,
            total: songs.length
        });
    } catch (error) {
        return res.status(500).json({
            songs: [],
            message: error.message
        });
    }
}
async function moveTempFileToSongs(tempInput, destinationFolder, songId) {
    if (!tempInput || typeof tempInput !== 'string') return tempInput;

    const bucket = admin.storage().bucket();
    let tempPath = tempInput;

    if (tempInput.includes("temp_storage")) {
        const decoded = decodeURIComponent(tempInput);
        const match = decoded.match(/temp_storage\/[^?#]+/);
        if (match) {
            tempPath = match[0];
        }
    }

    if (!tempPath.startsWith("temp_storage/")) {
        console.log("File không thuộc temp_storage, bỏ qua:", tempInput);
        return tempInput;
    }

    const tempFile = bucket.file(tempPath);
    const [exists] = await tempFile.exists();
    if (!exists) {
        console.log("File không tồn tại trên Cloud Storage:", tempPath);
        return tempInput;
    }

    const extMatch = tempPath.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[0] : "";
    
    const destinationPath = `${destinationFolder}/${songId}_${Date.now()}${ext}`;
    const destinationFile = bucket.file(destinationPath);

    await tempFile.copy(destinationFile);
    await tempFile.delete();

    await destinationFile.makePublic();
    return `https://storage.googleapis.com/${bucket.name}/${destinationPath}`;
}

const saveSong = async (req, res) => {
    try {
        const {
            id,
            title,
            artistId,
            album,
            artist,
            source,
            image,
            duration,
            favorite,
            counter,
            replay,
            isVip,
            genre,
            energy
        } = req.body;

        if (!title || typeof title !== 'string' || title.trim() === '') {
            return res.status(400).json({ message: "Tên bài hát (title) không được để trống" });
        }

        if (!album || typeof album !== 'string' || album.trim() === '') {
            return res.status(400).json({ message: "Tên album không được để trống" });
        }

        const validGenres = Object.values(Genre);
        if (!genre || !validGenres.includes(genre.toUpperCase())) {
            return res.status(400).json({
                message: `Thể loại (genre) không hợp lệ. Danh sách hợp lệ: ${validGenres.join(', ')}`
            });
        }

        const db = admin.firestore();

        const songRef = (id && id.trim() !== "")
            ? db.collection("songs").doc(id)
            : db.collection("songs").doc();

        const finalSongId = songRef.id;
        const finalImage = await moveTempFileToSongs(image, "songs/images", finalSongId);
        const finalSource = await moveTempFileToSongs(source, "songs/audio", finalSongId);

        const songData = {
            id: finalSongId,
            title: title.trim(),
            artistId: Number(artistId) || 0,
            album: album.trim(),
            artist: artist || "",
            source: finalSource || "",
            image: finalImage || "",
            duration: Number(duration) || 0,
            favorite: Boolean(favorite),
            counter: Number(counter) || 0,
            replay: Number(replay) || 0,
            isVip: Boolean(isVip),
            genre: genre.toUpperCase(),
            energy: typeof energy === 'number' ? energy : 0.5,
            createdAt: FieldValue.serverTimestamp()
        };

        await db.runTransaction(async (transaction) => {
            const albumQuery = db
                .collection("albums")
                .where("name", "==", songData.album)
                .limit(1);
            const albumSnap = await transaction.get(albumQuery);

            if (albumSnap.empty) {
                throw new Error(`Không tìm thấy Album có tên "${songData.album}" trong cơ sở dữ liệu.`);
            }

            const albumDoc = albumSnap.docs[0];
            const albumRef = albumDoc.ref;

            const songRef = (id && id.trim() !== "")
                ? db.collection("songs").doc(id)
                : db.collection("songs").doc();

            const finalSongId = songRef.id;
            songData.id = finalSongId;

            transaction.set(songRef, songData);

            transaction.update(albumRef, {
                songs: FieldValue.arrayUnion(finalSongId),
                updatedAt: FieldValue.serverTimestamp(),
                size: FieldValue.increment(1)
            });
        });

        return res.status(201).json({
            message: "Tạo bài hát và cập nhật Album thành công!",
            success: true
        });
    } catch (error) {
        return res.status(500).json({
            message: "Lưu thất bại: " + error.message,
            success: false
        });
    }
}

module.exports = {
    getSongsPaging, saveSong
};