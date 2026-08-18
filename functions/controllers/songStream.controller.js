const songService = require("../services/songStream.service");

class SonStreamgController {
  async streamSong(req, res) {
    try {
      const songId = req.params.songId;

      await songService.streamSong({
        songId,
        req,
        res,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({message: error.message});
    }
  }
}

module.exports = new SonStreamgController();
