const express = require("express");
const router = express.Router();
const songController = require("../controllers/song.controller");

// Admin Song Routes with full endpoint paths
router.get("/songs", songController.getSongsPaging);
router.post("/save-song", songController.saveSong);
router.post("/update-song", songController.updateSong);
router.post("/remove-song", songController.removeSong);

module.exports = router;
