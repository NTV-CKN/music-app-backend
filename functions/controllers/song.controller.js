const songService = require("../services/song.service");

class SongController {
  async getSongsPaging(req, res) {
    try {
      const searchQuery = req.query.query || "";
      const limit = parseInt(req.query.limit, 10) || 20;
      const pageKey = parseInt(req.query.key, 10) || 0;

      const songs = await songService.getSongsPaging(searchQuery, pageKey, limit);

      return res.status(200).json({
        songs,
        total: songs.length
      });
    } catch (error) {
      return res.status(500).json({
        songs: [],
        message: error.message
      });
    }
  }

  async saveSong(req, res) {
    try {
      const result = await songService.saveSong(req.body);

      return res.status(201).json(result);
    } catch (error) {
      return res.status(500).json({
        message: "Lưu thất bại: " + error.message,
        success: false
      });
    }
  }

  async updateSong(req, res) {
    try {
      const result = await songService.updateSong(req.body);

      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        message: "Cập nhật thất bại: " + error.message,
        success: false
      });
    }
  }

  async removeSong(req, res) {
    try {
      const { id } = req.body;
      const result = await songService.removeSong(id);

      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: `Xóa thất bại: ${error.message}`
      });
    }
  }
}

module.exports = new SongController();
