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

//routes
const songRoutes = require("./routes/song.route");
const albumRoutes = require("./routes/album.route");
const artistRoutes = require("./routes/artist.route");
const subscriptionRoutes = require("./routes/subscription.route");
const subscriptionPaymentRoutes = require("./routes/subscriptionPayment.route");

const app = express();
const adminRouter = express.Router();

app.use(cors({origin: true}));
app.use(express.json());

//API Public
app.post('/v1/auth/login', authenticateToken, login);

//API authorization
//API require Admin - middleware applied to all admin routes
adminRouter.use(authenticateToken, requireAdmin);

// Mount route modules on adminRouter - middleware applies to all
adminRouter.use(songRoutes);
adminRouter.use(albumRoutes);
adminRouter.use(artistRoutes);
adminRouter.use(subscriptionRoutes);

app.use('/v1/admin', adminRouter);
app.use('/v1', subscriptionPaymentRoutes);

exports.api = functions.https.onRequest(app);