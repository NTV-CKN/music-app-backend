const admin = require('firebase-admin');

//Authenticate token
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if(!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Thiếu token xác thực!"
        });
    }

    const idToken = authHeader.split("Bearer ")[1];

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.user = decodedToken; //cache user cho request khi qua trạm này

        return next();
    }catch(error) {
        return res.status(401).json({
            success: false,
            message: "Token không hợp lệ hoặc đã hết hạn!"
        });
    }
}

//Kiểm tra role admin
const requireAdmin = async(req, res, next) => {
    try{
        const uid = req.user? req.user.uid : null;

        if(!uid) {
            return res.status(401).json({
                success: false,
                message: "Chưa xác thực!"
            });
        }

        const userDoc = await admin.firestore().collection("users").doc(uid).get();

        if(!userDoc.exists || userDoc.data().role != "admin") {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền truy cập vào đây!"
            });
        } 

        return next();
    }catch(error) {
        return res.status(500).json({
            success: false,
            message: "Hệ thống xảy ra lỗi!"
        });
    }
}

module.exports = {
    authenticateToken,
    requireAdmin
};