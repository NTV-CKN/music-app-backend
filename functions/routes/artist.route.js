const express = require("express");
const router = express.Router();
const artistController = require("../controllers/artist.controller");
//authMiddleware
const { authenticateToken, requireAdmin } = require("../authMiddleware");

// Admin Artist Routes with full endpoint paths
router.get("/artists", authenticateToken, requireAdmin, artistController.getArtistsPaging);
router.post("/save-artist", authenticateToken, requireAdmin, artistController.saveArtist);
router.post("/delete-artist", authenticateToken, requireAdmin, artistController.deleteArtist);

module.exports = router;
