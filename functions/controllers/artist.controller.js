const artistService = require("../services/artist.service");

class ArtistController {
  async getArtistsPaging(req, res) {
    try {
      const searchQuery = req.query.query || "";
      const limit = parseInt(req.query.limit, 10) || 20;
      const pageKey = parseInt(req.query.key, 10) || 0;

      const artists = await artistService.getArtistsPaging(searchQuery, pageKey, limit);

      return res.status(200).json({
        artists,
      });
    } catch (error) {
      return res.status(500).json({
        message: error.message,
        artists: []
      });
    }
  }

  async saveArtist(req, res) {
    try {
      const result = await artistService.saveArtist(req.body);

      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        message: `Lưu nghệ sĩ thất bại: ${error.message}`,
        success: false
      });
    }
  }

  async deleteArtist(req, res) {
    try {
      const { id } = req.body;
      const result = await artistService.deleteArtist(id);

      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        message: `Xóa nghệ sĩ thất bại: ${error.message}`,
        success: false
      });
    }
  }
}

module.exports = new ArtistController();
