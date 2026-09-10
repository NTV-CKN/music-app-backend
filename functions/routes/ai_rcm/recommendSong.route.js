const express = require("express");
const router = express.Router();
const recommendSongController = require("../../controllers/ai_rcm/recommendSong.controller");

router.post("/ai-rcm/recommend", recommendSongController.getRecommendSong);

module.exports = router;
