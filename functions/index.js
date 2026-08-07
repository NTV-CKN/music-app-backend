const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");

//authMiddleware
const { authenticateToken, requireAdmin } = require("./authMiddleware");
//auth
const {login} = require("./auth")
//song admin
const {getSongsPaging} = require("./songAdmin")

if(!admin.apps.length) {
  admin.initializeApp();
}

const app = express();
app.use(cors({origin: true}));
app.use(express.json());

//API Public
app.post('/v1/auth/login', authenticateToken, login);
//API authorization
//API require Admin
app.use('/v1/admin-song', authenticateToken, requireAdmin);
app.get('/v1/admin-song/songs', getSongsPaging);

exports.api = functions.https.onRequest(app);