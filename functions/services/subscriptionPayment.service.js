const admin = require("firebase-admin");
const vnpay = require("../config/vnpayConfig");
const { FieldValue, Timestamp } = require("firebase-admin/firestore");
require("dotenv").config();

class PaymentService {
    async createPaymentUrl(userId, subscriptionId, clientIp) {
        const db = admin.firestore();

        const subscriptionRef = db.collection("subscriptions").doc(subscriptionId);
        const subscriptionSnap = await subscriptionRef.get();

        //Kiểm tra gói dịch vụ có tồn tại không
        if (!subscriptionSnap.exists) {
            const error = new Error("Gói dịch vụ không tồn tại");
            error.statusCode = 400;
            throw error;
        }

        const subscriptionData = subscriptionSnap.data();

        //Kiểm tra có đang hoạt động không
        if (!subscriptionData.isActive) {
            const error = new Error("Gói dịch vụ hiện tại không khả dụng");
            error.statusCode = 400;
            throw error;
        }

        const orderId = `VNP${Date.now()}`;
        const price = subscriptionData.price || 0;

        const orderRef = db.collection("order_subscriptions").doc(orderId);
        await orderRef.set({
            orderId: orderId,
            userId: userId,
            amount: price,
            paymentMethod: "VNPAY",
            status: "PENDING",
            createdAt: FieldValue.serverTimestamp(),
            subscriptionSnapshot: {
                subscriptionId: subscriptionData.id,
                subscriptionName: subscriptionData.packageName || subscriptionData.name || "",
                durationDays: subscriptionData.durationDays || 30,
                priceAtPurchase: price
            }
        });

        const paymentUrl = vnpay.buildPaymentUrl({
            vnp_Amount: price,
            vnp_TxnRef: orderId,
            vnp_OrderInfo: `Thanh toan gia han VIP ${subscriptionId}`,
            vnp_ReturnUrl: process.env.RETURN_URL,
            vnp_IpAddr: clientIp || "127.0.0.1"
        });

        return {
            paymentUrl,
            orderId
        };
    }

   async processVnpayReturn(queryParams) {
        const db = admin.firestore();

        const isValidSignature = vnpay.verifyReturnUrl(queryParams);
        if (!isValidSignature) {
            return {
                success: false,
                title: "Xác thực thất bại",
                message: "Chữ ký dữ liệu không hợp lệ. Giao dịch có thể đã bị can thiệp!"
            };
        }

        const vnp_ResponseCode = queryParams.vnp_ResponseCode;
        const orderId = queryParams.vnp_TxnRef;

        //Tìm đơn hàng theo mã đơn hàng
        const orderRef = db.collection("order_subscriptions").doc(orderId);
        const orderSnap = await orderRef.get();

        if (!orderSnap.exists) {
            return {
                success: false,
                title: "Thất bại",
                message: "Không tìm thấy thông tin đơn hàng!"
            };
        }

        const orderData = orderSnap.data();

        //Xử lí trường hợp không thành công
        if (vnp_ResponseCode !== "00") {
            if (orderData.status === "PENDING") {
                await orderRef.update({
                    status: "FAILED",
                    vnpayResponseCode: vnp_ResponseCode,
                    updatedAt: FieldValue.serverTimestamp()
                });
            }

            return {
                success: false,
                title: "Thanh toán thất bại",
                message: `Giao dịch bị hủy hoặc không thành công (Mã lỗi: ${vnp_ResponseCode}).`
            };
        }

        //Tránh đơn hàng thành công nhưng bị gọi lại
        if (orderData.status === "PENDING") {
            const userId = orderData.userId;
            const durationDays = orderData.subscriptionSnapshot?.durationDays || 30;
            const userRef = db.collection("users").doc(userId);

            await db.runTransaction(async (transaction) => {
                const userSnap = await transaction.get(userRef);
                if (!userSnap.exists) {
                    throw new Error("Người dùng không tồn tại");
                }

                const userData = userSnap.data();

                //Lấy ra ngày hết hạn vip của người dùng nếu có
                let currentExpiry = userData.vipExpiryDate ? userData.vipExpiryDate.toDate() : new Date();
                const now = new Date();

                if (!userData.isVip || currentExpiry < now) {
                    currentExpiry = now;
                }

                const newExpiryDate = new Date(currentExpiry.getTime() + durationDays * 24 * 60 * 60 * 1000);

                //Cập nhật User
                transaction.update(userRef, {
                    isVip: true,
                    vipExpiryDate: Timestamp.fromDate(newExpiryDate),
                    updateAt: FieldValue.serverTimestamp()
                });

                //Cập nhật Đơn hàng
                transaction.update(orderRef, {
                    status: "SUCCESS",
                    vnpayResponseCode: vnp_ResponseCode,
                    vnpayTransactionNo: queryParams.vnp_TransactionNo || "",
                    updatedAt: FieldValue.serverTimestamp()
                });
            });
        }

        return {
            success: true,
            title: "Thanh toán thành công! 🎉",
            message: "Tài khoản VIP của bạn đã được kích hoạt thành công."
        };
    }
}

module.exports = new PaymentService();