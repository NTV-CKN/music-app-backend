const admin = require('firebase-admin');

async function getUidFromHeader(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.split(' ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        return decodedToken.uid;
    } catch (error) {
        console.warn('Token không hợp lệ hoặc đã hết hạn:', error.message);
        return null;
    }
}

module.exports = { getUidFromHeader };