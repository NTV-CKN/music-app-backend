const admin = require("firebase-admin");

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

module.exports = {
    getSongsPaging
};