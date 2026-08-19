const rcmSongService = require("../../services/ai_rcm/recommendSong.service");

class RecommendSongController {
    async getRecommendSong(req, res) {
        try {
            const { promptClient } = req.body;
            const result = await rcmSongService.getAIHomeRecommendation(promptClient);

            return res.status(200).json(result);
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
}

module.exports = new RecommendSongController();