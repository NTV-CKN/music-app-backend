const express = require('express');
const router = express.Router();
const songController = require('../controllers/songStream.controller');

// Request: GET /api/v1/songs/stream/:songId
router.get('/songs/stream/:songId', songController.streamSong);

module.exports = router;