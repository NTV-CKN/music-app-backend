const express = require("express");
const router = express.Router();
const subPaymentController = require("../controllers/subscriptionPayment.controller");
const { authenticateToken } = require("../authMiddleware");

router.post("/create-url", authenticateToken, subPaymentController.createPaymentUrl);
router.get("/return-url", subPaymentController.handleVnpayReturn);

module.exports = router;