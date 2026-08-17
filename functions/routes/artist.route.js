const express = require("express");
const router = express.Router();
const artistController = require("../controllers/artist.controller");

// Admin Artist Routes with full endpoint paths
router.get("/artists", artistController.getArtistsPaging);
router.post("/save-artist", artistController.saveArtist);
router.post("/delete-artist", artistController.deleteArtist);

module.exports = router;
