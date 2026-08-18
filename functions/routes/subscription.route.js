const express = require("express");
const router = express.Router();
const subscriptionController = require("../controllers/subscription.controller");
//authMiddleware
const { authenticateToken, requireAdmin } = require("../authMiddleware");

// Admin Subscription Routes with full endpoint paths
router.get("/subscriptions", subscriptionController.getSubscriptionsPaging);
router.post("/save-subscription", authenticateToken, requireAdmin, subscriptionController.saveSubscription);
router.post("/update-subscription", authenticateToken, requireAdmin, subscriptionController.updateSubscription);

module.exports = router;
