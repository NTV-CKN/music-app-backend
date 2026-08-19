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
      return res.status(statusCode).json({ message: error.message });
    }
  }

  async countSong(req, res) {
    try {
      const { songId } = req.params;

      await songService.countSong(songId);

      return res.status(200).json({
        success: true,
        message: "Cập nhật lượt nghe thành công",
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "Lỗi hệ thống: " + err.message,
      });
    }
  }
}

module.exports = new SonStreamgController();
