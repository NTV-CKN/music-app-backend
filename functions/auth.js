const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");

if (!admin.apps.length) {
  admin.initializeApp();
}

async function verifyFirebaseToken(req, res) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({error: "Missing bearer token"});
    return null;
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    return decodedToken;
  } catch (error) {
    logger.error("Token verification failed", error);
    res.status(401).json({error: "Unauthorized"});
    return null;
  }
}

module.exports = {
  verifyFirebaseToken,
};
