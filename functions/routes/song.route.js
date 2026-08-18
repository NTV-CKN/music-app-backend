const express = require("express");
const router = express.Router();
const songController = require("../controllers/song.controller");
//authMiddleware
const { authenticateToken, requireAdmin } = require("../authMiddleware");

// Admin Song Routes with full endpoint paths
router.get("/songs", authenticateToken, requireAdmin, songController.getSongsPaging);
router.post("/save-song", authenticateToken, requireAdmin, songController.saveSong);
router.post("/update-song", authenticateToken, requireAdmin, songController.updateSong);
router.post("/remove-song", authenticateToken, requireAdmin, songController.removeSong);

module.exports = router;
