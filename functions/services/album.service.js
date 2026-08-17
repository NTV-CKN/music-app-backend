const admin = require("firebase-admin");
const { moveTempFileToDest, deleteFileFromStorage } = require("../admin/utilsStorage");
const { FieldValue } = require("firebase-admin/firestore");

class AlbumService {
  async getAlbumsPaging(query, key, limit) {
    const offset = limit * key;
    let queryAlbum = admin.firestore().collection("albums");

    if (query !== "") {
      const strFrontCode = query;
      const strEndCode = query + "\uf8ff";

      queryAlbum = queryAlbum
        .where("name", ">=", strFrontCode)
        .where("name", "<=", strEndCode);
    }

    const albumsSnap = await queryAlbum
      .limit(limit)
      .offset(offset)
      .get();

    return albumsSnap.docs.map((album) => ({
      ...album.data(),
    }));
  }

  async saveAlbum(payload) {
    const { id, name, songs, size, artwork } = payload;

    if (!id || typeof id !== "string" || id.trim() === "") {
      throw new Error("Id album không hợp lệ");
    }

    if (!name || typeof name !== "string" || name.trim() === "") {
      throw new Error("Tên album không hợp lệ");
    }

    if (!Array.isArray(songs) || songs.length === 0 ||
      !songs.every(item => typeof item === "string" && item.trim() !== "")) {
      throw new Error("Mảng bài hát không hợp lệ hoặc chứa ID rỗng");
    }

    if (!artwork || typeof artwork !== "string" || artwork.trim() === "") {
      throw new Error("Artwork không hợp lệ");
    }

    if (!size || !Number.isInteger(size) || size !== songs.length) {
      throw new Error("Kích thước không hợp lệ hoặc không khớp với độ dài songs");
    }

    const finalArtwork = await moveTempFileToDest(artwork, "albums/artwork", id.trim());

    const db = admin.firestore();
    const albumDocRef = db.collection("albums").doc(id.trim());

    await db.runTransaction(async (transaction) => {
      const albumDocSnap = await transaction.get(albumDocRef);

      let oldSongs = [];
      if (albumDocSnap.exists) {
        oldSongs = albumDocSnap.data().songs || [];
      }
      const removedSongIds = oldSongs.filter(oldId => !songs.includes(oldId));

      const songSnaps = await Promise.all(
        songs.map(songId => transaction.get(db.collection("songs").doc(songId)))
      );

      songSnaps.forEach((songSnap, index) => {
        if (!songSnap.exists) {
          throw new Error(`Bài hát với ID '${songs[index]}' không tồn tại trên hệ thống`);
        }
      });

      const removedSongSnaps = await Promise.all(
        removedSongIds.map(removedId => transaction.get(db.collection("songs").doc(removedId)))
      );

      //update album in song
      songSnaps.forEach(songSnap => {
        transaction.update(songSnap.ref, {
          album: name.trim(),
          updatedAt: FieldValue.serverTimestamp()
        });
      });

      removedSongSnaps.forEach(removedSnap => {
        if (removedSnap.exists) {
          transaction.update(removedSnap.ref, {
            album: "",
            updatedAt: FieldValue.serverTimestamp()
          });
        }
      });

      if (!albumDocSnap.exists) {
        transaction.set(albumDocRef, {
          id: id.trim(),
          name: name.trim(),
          songs: songs,
          size: size,
          artwork: finalArtwork,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
      } else {
        transaction.update(albumDocRef, {
          name: name.trim(),
          songs: songs,
          size: size,
          artwork: finalArtwork,
          updatedAt: FieldValue.serverTimestamp()
        });
      }
    });

    return { success: true, message: "Lưu album và cập nhật danh sách bài hát thành công" };
  }

  async deleteAlbum(id) {
    if (!id || typeof id !== "string" || id.trim() === "") {
      throw new Error("Id album không hợp lệ");
    }

    const db = admin.firestore();
    let artwork = null;

    await db.runTransaction(async (transaction) => {
      const albumSnapshot = await transaction.get(
        db.collection("albums").doc(id)
      );
      if (!albumSnapshot.exists) {
        throw new Error("Không tìm thấy album này");
      }

      const songs = albumSnapshot.data().songs || [];
      artwork = albumSnapshot.data().artwork;

      const songsSnapshot = await Promise.all(
        songs.map(songId => transaction.get(db.collection("songs").doc(songId)))
      );

      //write
      songsSnapshot.forEach(songSnap => {
        if (songSnap.exists) {
          transaction.update(songSnap.ref, {
            album: "",
            updatedAt: FieldValue.serverTimestamp()
          });
        }
      });

      transaction.delete(albumSnapshot.ref);
    });

    if (artwork) {
      await deleteFileFromStorage(artwork);
    }

    return { success: true, message: `Xóa thành công album` };
  }
}

module.exports = new AlbumService();
