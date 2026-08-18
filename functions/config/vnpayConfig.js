const {VNPay} = require("vnpay");
require("dotenv").config();

const vnpay = new VNPay({
  tmnCode: process.env.VNP_TMN_CODE || "",
  secureSecret: process.env.VNP_HASH_SECRET || "",
  vnpayHost: process.env.VNP_HOST || "https://sandbox.vnpayment.vn",
  testMode: true,
  hashAlgorithm: "SHA512",
});

module.exports = vnpay;
