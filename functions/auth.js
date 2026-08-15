const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const { FieldValue } = require("firebase-admin/firestore");

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
    }else {
      userData = userDoc.data();
    }
    
    return res.status(200).json({
      success: true,
      message: "Đăng nhập thành công!",
      userData: userData
    });

  } catch (error) {
     return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống: " + error.message,
      userData: null
    });
  }
}

module.exports = {
  login
};
