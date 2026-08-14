const admin = require("firebase-admin");
const { moveTempFileToDest } = require("./utilsStorage");
const { FieldValue } = require("firebase-admin/firestore");
const Long = require("long");

const getArtistsPaging = async (req, res) => {
    try {
        const searchQuery = req.query.query || "";
        const limit = parseInt(req.query.limit, 10) || 20;
        const pageKey = parseInt(req.query.key, 10) || 0;
        const offset = pageKey * limit;

        let artistQuery = admin.firestore().collection("artists");

        if (searchQuery !== "") {
            const strFrontCode = searchQuery;
            const strEndCode = searchQuery + "\uf8ff";

            artistQuery = artistQuery
                .where('name', '>=', strFrontCode)
                .where('name', '<=', strEndCode);
        }

        const artistsSnap = await artistQuery
            .limit(limit)
            .offset(offset)
            .get();

        const artists = artistsSnap.docs.map(artist => ({
            ...artist.data(),
        }));

        return res.status(200).json({
            artists: artists,
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message,
            artists: []
        });
    }
}

const saveArtist = async (req, res) => {
    try {
        const {
            id,
            name,
            avatar,
            amountInterested
        } = req.body;

        if (id === undefined || id === null || id === "") {
            throw new Error("Mã nghệ sĩ không hợp lệ");
        }

        if (!name || typeof name !== "string" || name === "") {
            throw new Error("Tên nghệ sĩ không hợp lệ");
        }

        if (!avatar || typeof avatar !== "string" || avatar === "") {
            throw new Error("Ảnh đại diện nghệ sĩ không hợp lệ");
        }

        const db = admin.firestore();
        
        const artistIdLong = Long.fromValue(id);
        let artistIdStr = String(artistIdLong);
        
        const finalAvatar = await moveTempFileToDest(avatar, "artists/avatar", artistIdStr);

        let isSongsUpdate = false;
        await db.runTransaction(async (transaction) => {
            const artistDocSnap = await transaction.get(
                db.collection("artists").doc(artistIdStr)
            );

            if (artistDocSnap.exists) {
                isSongsUpdate = artistDocSnap.data().name !== name

                transaction.update(artistDocSnap.ref, {
                    avatar: finalAvatar,
                    name: name,
                    updatedAt: FieldValue.serverTimestamp()
                });
            } else {
                transaction.set(artistDocSnap.ref, {
                    id: id,
                    name: name,
                    avatar: finalAvatar,
                    amount_interested: amountInterested ?? 0,
                    createAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp()
                });
            }
        });

        if (isSongsUpdate) {
            const songsSnapshot = await db
                .collection("songs")
                .where("artistId", "==", artistIdStr)
                .get();

            if (!songsSnapshot.empty) {
                const docs = songsSnapshot.docs;
                const CHUNK_SIZE = 400;

                for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
                    const chunk = docs.slice(i, i + CHUNK_SIZE);
                    const batch = db.batch();

                    chunk.forEach(songDoc => {
                        batch.update(songDoc.ref, {
                            artist: name,
                            updatedAt: FieldValue.serverTimestamp()
                        });
                    });

                    await batch.commit();
                }
            }
        }

        return res.status(200).json({
            message: "Lưu nghệ sĩ thành công",
            success: true
        });
    } catch (error) {
        return res.status(500).json({
            message: `Lưu nghệ sĩ thất bại: ${error.message}`,
            success: false
        });
    }
}

module.exports = {
    getArtistsPaging, saveArtist
}