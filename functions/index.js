const functions = require("firebase-functions");
const admin = require("firebase-admin");

if(!admin.apps.length) {
  admin.initializeApp();
}

const express = require("express");
const cors = require("cors");

//authMiddleware
const { authenticateToken, requireAdmin } = require("./authMiddleware");
//auth
const {login} = require("./auth")
//song admin
const {getSongsPaging, saveSong, updateSong, removeSong} = require("./admin/songAdmin")

//album admin
const {getAlbumsPaging, saveAlbum, deleteAlbum} = require("./admin/albumAdmin")

//artist admin
const {getArtistsPaging, saveArtist, deleteArtist} = require("./admin/artistAdmin")

//subscription admin
const {getSubscriptionsPaging} = require("./admin/subscriptionAdmin")

const app = express();
const adminRouter = express.Router();

app.use(cors({origin: true}));
app.use(express.json());

app.get('/v1/admin-artist/artists', getArtistsPaging)

//API Public
app.post('/v1/auth/login', authenticateToken, login);
//API authorization
//API require Admin
// adminRouter.use(authenticateToken, requireAdmin);

//admin song
adminRouter.get('/songs', getSongsPaging);
adminRouter.post('/save-song', saveSong);
adminRouter.post('/update-song', updateSong);
adminRouter.post('/remove-song', removeSong);

//admin album
adminRouter.get('/albums', getAlbumsPaging);
adminRouter.post('/save-album', saveAlbum);
adminRouter.post('/delete-album', deleteAlbum);

//admin artist
adminRouter.get('/artists', getArtistsPaging);
adminRouter.post('/save-artist', saveArtist);
adminRouter.post('/delete-artist', deleteArtist);

//admin subscription
adminRouter.get('/subscriptions', getSubscriptionsPaging);

app.use('/v1/admin', adminRouter);

exports.api = functions.https.onRequest(app);