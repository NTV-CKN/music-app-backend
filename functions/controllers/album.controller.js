const albumService = require("../services/album.service");

class AlbumController {
  async getAlbumsPaging(req, res) {
    try {
      const query = req.query.query || "";
      const key = parseInt(req.query.key, 10) || 0;
      const limit = parseInt(req.query.limit, 10) || 20;

      const albums = await albumService.getAlbumsPaging(query, key, limit);

      return res.status(200).json({
        albums,
      });
    } catch (error) {
      return res.status(500).json({
        message: error.message,
        albums: [],
      });
    }
  }

  async saveAlbum(req, res) {
    try {
      const result = await albumService.saveAlbum(req.body);

      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: `Lưu album thất bại: ${error.message}`,
      });
    }
  }

  async deleteAlbum(req, res) {
    try {
      const {id} = req.body;
      const result = await albumService.deleteAlbum(id);

      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: `Xóa album thất bại: ${error.message}`,
      });
    }
  }
}

module.exports = new AlbumController();
