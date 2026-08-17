const subscriptionService = require("../services/subscription.service");

class SubscriptionController {
  async getSubscriptionsPaging(req, res) {
    try {
      const query = req.query.query || "";
      const key = parseInt(req.query.key, 10) || 0;
      const limit = parseInt(req.query.limit, 10) || 20;

      const subscriptions = await subscriptionService.getSubscriptionsPaging(query, key, limit);

      return res.status(200).json({
        subscriptions,
      });
    } catch (error) {
      return res.status(500).json({
        message: error.message,
        subscriptions: [],
      });
    }
  }

  async saveSubscription(req, res) {
    try {
      const payload = req.body || {};
      const subscription = await subscriptionService.saveSubscription(payload);

      return res.status(201).json({
        message: "Thêm subscription thành công",
        success: true,
        subscription,
      });
    } catch (error) {
      return res.status(400).json({
        message: error.message,
        success: false,
      });
    }
  }

  async updateSubscription(req, res) {
    try {
      const payload = req.body || {};
      const subscription = await subscriptionService.updateSubscription(payload);

      return res.status(200).json({
        message: "Cập nhật subscription thành công",
        success: true,
        subscription,
      });
    } catch (error) {
      return res.status(400).json({
        message: error.message,
        success: false,
      });
    }
  }
}

module.exports = new SubscriptionController();
