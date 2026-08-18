const admin = require("firebase-admin");
const {moveTempFileToDest, deleteFileFromStorage} = require("../admin/utilsStorage");
const {FieldValue} = require("firebase-admin/firestore");
const Long = require("long");

class ArtistService {
  async getArtistsPaging(searchQuery, pageKey, limit) {
    const offset = pageKey * limit;
    let artistQuery = admin.firestore().collection("artists");

    if (searchQuery !== "") {
      const strFrontCode = searchQuery;
      const strEndCode = searchQuery + "\uf8ff";

      artistQuery = artistQuery
        .where("name", ">=", strFrontCode)
        .where("name", "<=", strEndCode);
    }

    const artistsSnap = await artistQuery
      .limit(limit)
      .offset(offset)
      .get();

    return artistsSnap.docs.map((artist) => ({
      ...artist.data(),
    }));
  }

  async saveArtist(payload) {
    const {id, name, avatar, amountInterested} = payload;

    if (id === undefined || id === null || id === "") {
      throw new Error("Mã nghệ sĩ không hợp lệ");
    }

    if (!name || typeof name !== "string" || name === "") {
      throw new Error("Tên nghệ sĩ không hợp lệ");
    }

    if (!avatar || typeof avatar !== "string" || avatar === "") {
      throw new Error("Ảnh đại diện nghệ sĩ không hợp lệ");
    }

    const db = admin.firestore();

    const artistIdLong = Long.fromValue(id);
    const artistIdNum = artistIdLong.toNumber();
    const artistIdStr = String(artistIdNum);

    const finalAvatar = await moveTempFileToDest(avatar, "artists/avatar", artistIdStr);

    let isSongsUpdate = false;
    let oldAvatar = null;

    await db.runTransaction(async (transaction) => {
      const artistDocSnap = await transaction.get(
        db.collection("artists").doc(artistIdStr)
      );

      if (artistDocSnap.exists) {
        if (artistDocSnap.data().avatar !== finalAvatar) {
          oldAvatar = artistDocSnap.data().avatar;
        }
        isSongsUpdate = artistDocSnap.data().name !== name;

        transaction.update(artistDocSnap.ref, {
          avatar: finalAvatar,
          name: name,
          updatedAt: FieldValue.serverTimestamp()
        });
      } else {
        transaction.set(artistDocSnap.ref, {
          id: artistIdNum,
          name: name,
          avatar: finalAvatar,
          amount_interested: amountInterested ?? 0,
          createAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
      }
    });

    if (isSongsUpdate) {
      const songsSnapshot = await db
        .collection("songs")
        .where("artistId", "in", [artistIdNum])
        .get();
      if (!songsSnapshot.empty) {
        const docs = songsSnapshot.docs;
        const CHUNK_SIZE = 400;

        for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
          const chunk = docs.slice(i, i + CHUNK_SIZE);
          const batch = db.batch();

          chunk.forEach((songDoc) => {
            batch.update(songDoc.ref, {
              artist: name,
              updatedAt: FieldValue.serverTimestamp()
            });
          });

          await batch.commit();
        }
      }
    }

    if (oldAvatar) {
      await deleteFileFromStorage(oldAvatar);
    }

    return {message: "Lưu nghệ sĩ thành công", success: true};
  }

  async deleteArtist(id) {
    if (id === undefined || id === null || id === "") {
      throw new Error("Mã nghệ sĩ không hợp lệ");
    }

    const db = admin.firestore();

    const artistIdLong = Long.fromValue(id);
    const artistIdNum = artistIdLong.toNumber();
    const artistIdStr = String(artistIdNum);

    const artistRef = db.collection("artists").doc(artistIdStr);
    const artistSnap = await artistRef.get();

    if (!artistSnap.exists) {
      throw new Error("Không tìm thấy nghệ sĩ để xóa");
    }

    const artistData = artistSnap.data();
    const avatarUrl = artistData ? artistData.avatar : null;

    const songsSnapshot = await db
      .collection("songs")
      .where("artistId", "in", [artistIdNum, artistIdStr])
      .get();

    if (!songsSnapshot.empty) {
      const docs = songsSnapshot.docs;
      const CHUNK_SIZE = 400;

      for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
        const chunk = docs.slice(i, i + CHUNK_SIZE);
        const batch = db.batch();

        chunk.forEach((songDoc) => {
          batch.update(
            songDoc.ref,
            {
              artist: "",
              artistId: Number()
            }
          );
        });

        await batch.commit();
      }
    }

    await artistRef.delete();

    if (avatarUrl) {
      try {
        await deleteFileFromStorage(avatarUrl);
      } catch (storageErr) {
        console.error("Lỗi xóa file avatar trên Storage:", storageErr.message);
      }
    }

    return {message: "Xóa nghệ sĩ thành công", success: true};
  }
}

module.exports = new ArtistService();
