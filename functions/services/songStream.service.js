const admin = require("firebase-admin");
const fs = require("fs");
const {getUidFromHeader} = require("../utils/auth.util");

class SongStreamService {
  async streamSong({songId, req, res}) {
    const db = admin.firestore();

    const songDoc = await db.collection("songs").doc(songId).get();
    if (!songDoc.exists) {
      const error = new Error("Không tìm thấy bài hát!");
      error.statusCode = 404;
      throw error;
    }

    const songData = songDoc.data();

    if (songData.isVip) {
      const uid = await getUidFromHeader(req);

      if (!uid) {
        const error = new Error("Bài hát VIP! Vui lòng đăng nhập để nghe.");
        error.statusCode = 401;
        throw error;
      }

      const userDoc = await db.collection("users").doc(uid).get();
      if (!userDoc.exists) {
        const error = new Error("Tài khoản người dùng không tồn tại!");
        error.statusCode = 403;
        throw error;
      }

      const userData = userDoc.data();
      const isUserVip = userData.isVip === true;
      const vipExpiryDate = userData.vipExpiryDate;

      let isExpired = true;
      if (vipExpiryDate) {
        const expiryDate = vipExpiryDate.toDate ? vipExpiryDate.toDate() : new Date(vipExpiryDate);
        isExpired = expiryDate < new Date();
      }

      if (!isUserVip || isExpired) {
        const error = new Error("Bài hát VIP! Bạn cần nâng cấp tài khoản VIP để nghe.");
        error.statusCode = 403;
        throw error;
      }
    }

    if (songData.source.startsWith("http://") || songData.source.startsWith("https://")) {
      return res.redirect(302, songData.source);
    }

    this._pipeAudioStream(songData.source, req, res);
  }

  _pipeAudioStream(filePath, req, res) {
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({message: "File nhạc không tồn tại trên Server!"});
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      const fileStream = fs.createReadStream(filePath, {start, end});
      const headers = {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": "audio/mpeg",
      };

      res.writeHead(206, headers);
      fileStream.pipe(res);
    } else {
      const headers = {
        "Content-Length": fileSize,
        "Content-Type": "audio/mpeg",
      };

      res.writeHead(200, headers);
      fs.createReadStream(filePath).pipe(res);
    }
  }
}

module.exports = new SongStreamService();
