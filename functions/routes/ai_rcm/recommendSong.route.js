const express = require("express");
const router = express.Router();
const RecommendSongController = require("../../controllers/ai_rcm/recommendSong.controller");
const recommendSongController = require("../../controllers/ai_rcm/recommendSong.controller");

router.post("/ai-rcm/recommend", recommendSongController.getRecommendSong);

module.exports = router;