const paymentService = require("../services/subscriptionPayment.service");

const createPaymentUrl = async (req, res) => {
  try {
    const {subscriptionId} = req.body;
    const userId = req.user.uid;

    if (!subscriptionId) {
      return res.status(400).json({
        status: "error",
        message: "subscriptionId không được để trống",
      });
    }

    const clientIp = (req.headers["x-forwarded-for"] || req.ip || "127.0.0.1")
        .split(",")[0]
        .trim();

    const result = await paymentService.createPaymentUrl(userId, subscriptionId, clientIp);

    return res.status(200).json({
      status: "success",
      paymentUrl: result.paymentUrl,
      orderId: result.orderId,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: "error",
      message: error.message || "Đã xảy ra lỗi khi tạo yêu cầu thanh toán",
    });
  }
};

const handleVnpayReturn = async (req, res) => {
  try {
    const result = await paymentService.processVnpayReturn(req.query);
    return res.status(200).send(renderHtmlResponse(result));
  } catch (error) {
    console.error("Lỗi Controller vnpay-return:", error);
    return res.status(500).send(renderHtmlResponse({
      success: false,
      title: "Lỗi hệ thống",
      message: error.message || "Đã xảy ra lỗi trong quá trình xử lý đơn hàng.",
    }));
  }
};

function renderHtmlResponse({success, title, message}) {
  return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Kết quả thanh toán</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                display: flex; justify-content: center; align-items: center;
                height: 100vh; margin: 0; background-color: #f5f5f5;
            }
            .card {
                background: white; padding: 32px 24px; border-radius: 16px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.08); text-align: center;
                max-width: 90%; width: 320px;
            }
            .icon {
                font-size: 48px; margin-bottom: 12px;
            }
            h2 { color: #333; margin: 0 0 12px 0; font-size: 20px; }
            p { color: #666; font-size: 14px; line-height: 1.5; margin: 0; }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="icon">${success ? "✅" : "❌"}</div>
            <h2>${title}</h2>
            <p>${message}</p>
        </div>
    </body>
    </html>
    `;
}

module.exports = {
  createPaymentUrl,
  handleVnpayReturn,
};
