const admin = require("firebase-admin");
const { Genre } = require("../genreSong");
const { FieldValue } = require("firebase-admin/firestore");
const { moveTempFileToDest, deleteFileFromStorage } = require("./utilsStorage");

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

const updateSong = async (req, res) => {
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

        if (!id || typeof id !== 'string' || id.trim() === '') {
            return res.status(400).json({ message: "ID bài hát không được để trống khi update" });
        }

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
        const songRef = db.collection("songs").doc(id);

        const finalSongId = songRef.id;
        const finalImage = await moveTempFileToDest(image, "songs/images", finalSongId);
        const finalSource = await moveTempFileToDest(source, "songs/audio", finalSongId);

        const newAlbumName = album.trim();

        let oldImage = null, oldSource;

        await db.runTransaction(async (transaction) => {
            songDoc = await transaction.get(songRef);
            if (!songDoc.exists) {
                throw new Error("Không tìm thấy bài hát cần cập nhật.");
            }

            oldImage = songDoc.data().image;
            oldSource = songDoc.data().source;

            const oldAlbumName = songDoc.data().album || "";
            const isAlbumChanged = oldAlbumName !== "" && oldAlbumName !== newAlbumName;

            let oldAlbumRef = null;
            if (isAlbumChanged) {
                const oldAlbumSnapshot = await transaction
                    .get(db.collection("albums").where("name", "==", oldAlbumName).limit(1));


                if (!oldAlbumSnapshot.empty) {
                    oldAlbumRef = oldAlbumSnapshot.docs[0].ref;
                }
            }

            let newAlbumRef = null;
            if (oldAlbumName !== newAlbumName) {
                const newAlbumSnapshot = await transaction.get(
                    db
                        .collection("albums")
                        .where("name", "==", newAlbumName)
                        .limit(1)
                );

                if (newAlbumSnapshot.empty)
                    throw new Error("Không tìm thấy album mới này");

                newAlbumRef = newAlbumSnapshot.docs[0].ref;
            }

            const songData = {
                id: finalSongId,
                title: title.trim(),
                artistId: Number(artistId) || 0,
                album: newAlbumName,
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
                updatedAt: FieldValue.serverTimestamp()
            };

            transaction.update(songRef, songData);

            if (oldAlbumRef) {
                transaction.update(oldAlbumRef, {
                    songs: FieldValue.arrayRemove(finalSongId),
                    updatedAt: FieldValue.serverTimestamp(),
                    size: FieldValue.increment(-1)
                });
            }

            if (newAlbumRef) {
                transaction.update(newAlbumRef, {
                    songs: FieldValue.arrayUnion(finalSongId),
                    updatedAt: FieldValue.serverTimestamp(),
                    size: FieldValue.increment(1)
                })
            }
        });

        try {
            if (oldSource) await deleteFileFromStorage(oldSource);
            if (oldImage) await deleteFileFromStorage(oldImage);
        } catch (error) {

        }

        return res.status(200).json({
            message: "Cập nhật bài hát thành công!",
            success: true
        });
    } catch (error) {
        return res.status(500).json({
            message: "Cập nhật thất bại: " + error.message,
            success: false
        });
    }
}

const removeSong = async (req, res) => {
    try {
        const {
            id
        } = req.body;

        if (!id || typeof id !== "string" || id === "") {
            throw new Error("Mã bài hát không hợp lệ");
        }

        const db = admin.firestore();
        const songDocRef = db.collection("songs").doc(id);

        let sourceDel = null, imageDel = null;

        await db.runTransaction(async (transaction) => {
            const songDocSnapshot = await transaction.get(songDocRef);

            if (!songDocSnapshot.exists)
                throw new Error("Nhạc không tồn tại");

            const album = songDocSnapshot.data().album || "";
            sourceDel = songDocSnapshot.data().source;
            imageDel = songDocSnapshot.data().image;

            let albumDocRef = null;
            if (album !== "") {
                const albumQuerySnapshot = await transaction.get(
                    db.collection("albums")
                        .where("name", "==", album)
                        .limit(1)
                );

                if (!albumQuerySnapshot.empty) {
                    albumDocRef = albumQuerySnapshot.docs[0].ref;
                }
            }

            //remove song
            transaction.delete(songDocRef);

            //remove song trong album
            if (albumDocRef) {
                transaction.update(albumDocRef, {
                    songs: FieldValue.arrayRemove(id),
                    updatedAt: FieldValue.serverTimestamp(),
                    size: FieldValue.increment(-1)
                });
            }
        });
        const deleteTasks = [];
        if (imageDel) deleteTasks.push(deleteFileFromStorage(imageDel));
        if (sourceDel) deleteTasks.push(deleteFileFromStorage(sourceDel));

        if (deleteTasks.length > 0) {
            await Promise.allSettled(deleteTasks);
        }

        return res.status(200).json({
            success: true,
            message: "Xóa thành công"
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: `Xóa thất bại: ${error.message}`
        });
    }
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
        const finalImage = await moveTempFileToDest(image, "songs/images", finalSongId);
        const finalSource = await moveTempFileToDest(source, "songs/audio", finalSongId);

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
    getSongsPaging, saveSong, updateSong, removeSong
};