const admin = require("firebase-admin");
const {FieldValue} = require("firebase-admin/firestore");

const login = async (req, res) => {
  try {
    const user = req.user;

    const uid = user.uid;
    const email = user.email || "";
    const name = user.name || "";
    const avatar = user.picture || "";

    const userRef = admin.firestore().collection("users").doc(uid);
    const userDoc = await userRef.get();

    let userData;

    if (!userDoc.exists) {
      userData = {
        uid: uid,
        email: email,
        displayName: name,
        avatar: avatar,
        role: "user",
        isVip: false,
        vipExpiryDate: null,
        createAt: FieldValue.serverTimestamp(),
        updateAt: FieldValue.serverTimestamp(),
      };

      await userRef.set(userData);
    } else {
      userData = userDoc.data();

      if (userData.vipExpiryDate && typeof userData.vipExpiryDate.toDate === "function") {
        userData.vipExpiryDate = userData.vipExpiryDate.toDate().toISOString();
      } else {
        userData.vipExpiryDate = null;
      }

      if (userData.createdAt && typeof userData.createdAt.toDate === "function") {
        userData.createdAt = userData.createdAt.toDate().toISOString();
      }
      if (userData.updatedAt && typeof userData.updatedAt.toDate === "function") {
        userData.updatedAt = userData.updatedAt.toDate().toISOString();
      }
    }

    return res.status(200).json({
      success: true,
      message: "Đăng nhập thành công!",
      userData: userData,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống: " + error.message,
      userData: null,
    });
  }
};

module.exports = {
  login,
};
