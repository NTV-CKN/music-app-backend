const admin = require("firebase-admin");

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

module.exports = {
    getArtistsPaging
}