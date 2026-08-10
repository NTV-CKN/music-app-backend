const admin = require("firebase-admin");

const getAlbumsPaging = async (req, res) => {
    try {
        const query = req.query.query || "";
        const key = parseInt(req.query.key, 10) || 0;
        const limit = parseInt(req.query.limit, 10) || 20;
        const offset = limit * key;

        let queryAlbum = admin.firestore().collection("albums");

        if (query !== "") {
            const strFrontCode = query;
            const strEndCode = query + "\uf8ff";

            queryAlbum = queryAlbum
                .where('name', '>=', strFrontCode)
                .where('name', '<=', strEndCode);
        }

        const albumsSnap = await queryAlbum
            .limit(limit)
            .offset(offset)
            .get();

        const albums = albumsSnap.docs.map(album => ({
            ...album.data(),
        }));

        return res.status(200).json({
            albums: albums,
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message,
            albums: []
        });
    }
}

module.exports = {
    getAlbumsPaging
}