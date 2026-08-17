const express = require("express");
const router = express.Router();
const albumController = require("../controllers/album.controller");

// Admin Album Routes with full endpoint paths
router.get("/albums", albumController.getAlbumsPaging);
router.post("/save-album", albumController.saveAlbum);
router.post("/delete-album", albumController.deleteAlbum);

module.exports = router;
