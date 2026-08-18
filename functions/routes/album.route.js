const express = require("express");
const router = express.Router();
const albumController = require("../controllers/album.controller");
//authMiddleware
const { authenticateToken, requireAdmin } = require("../authMiddleware");

// Admin Album Routes with full endpoint paths
router.get("/albums", authenticateToken, requireAdmin, albumController.getAlbumsPaging);
router.post("/save-album", authenticateToken, requireAdmin, albumController.saveAlbum);
router.post("/delete-album", authenticateToken, requireAdmin, albumController.deleteAlbum);

module.exports = router;
