const express = require("express");
const router = express.Router();
const subscriptionController = require("../controllers/subscription.controller");

// Admin Subscription Routes with full endpoint paths
router.get("/subscriptions", subscriptionController.getSubscriptionsPaging);
router.post("/save-subscription", subscriptionController.saveSubscription);
router.post("/update-subscription", subscriptionController.updateSubscription);

module.exports = router;
