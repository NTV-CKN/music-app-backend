const admin = require("firebase-admin");

class SubscriptionService {
  async getSubscriptionsPaging(query, key, limit) {
    const offset = limit * key;
    let subscriptionQuery = admin.firestore().collection("subscriptions");

    if (query !== "") {
      const strFrontCode = query;
      const strEndCode = query + "\uf8ff";

      subscriptionQuery = subscriptionQuery
          .where("name", ">=", strFrontCode)
          .where("name", "<=", strEndCode);
    }

    const subscriptionSnap = await subscriptionQuery
        .limit(limit)
        .offset(offset)
        .get();

    return subscriptionSnap.docs.map((subscription) => {
      const data = subscription.data();
      return {
        ...data,
        createAt: this.normalizeDateValue(data.createAt),
        updateAt: this.normalizeDateValue(data.updateAt),
      };
    });
  }

  async saveSubscription(payload) {
    this.validateSubscriptionPayload(payload, false);

    const db = admin.firestore();
    const docId = payload.id.trim();
    const subscriptionRef = db.collection("subscriptions").doc(docId);
    const existingSnap = await subscriptionRef.get();

    if (existingSnap.exists) {
      throw new Error(`Subscription với id '${docId}' đã tồn tại`);
    }

    const nowIso = new Date().toISOString();

    const subscriptionData = {
      id: docId,
      name: payload.name.trim(),
      description: typeof payload.description === "string" ? payload.description.trim() : "",
      price: Number(payload.price),
      durationDays: Number(payload.durationDays),
      isActive: Boolean(payload.isActive),
      createAt: nowIso,
      updateAt: nowIso,
    };

    await subscriptionRef.set(subscriptionData);
    return subscriptionData;
  }

  async updateSubscription(payload) {
    this.validateSubscriptionPayload(payload, true);

    const db = admin.firestore();
    const docId = payload.id.trim();
    const subscriptionRef = db.collection("subscriptions").doc(docId);
    const existingSnap = await subscriptionRef.get();

    if (!existingSnap.exists) {
      throw new Error(`Subscription với id '${docId}' không tồn tại`);
    }

    const nowIso = new Date().toISOString();
    const existingData = existingSnap.data() || {};

    const updatedData = {
      id: docId,
      name: payload.name.trim(),
      description: typeof payload.description === "string" ? payload.description.trim() : "",
      price: Number(payload.price),
      durationDays: Number(payload.durationDays),
      isActive: Boolean(payload.isActive),
      createAt: existingData.createAt || nowIso,
      updateAt: nowIso,
    };

    await subscriptionRef.update({
      name: updatedData.name,
      description: updatedData.description,
      price: updatedData.price,
      durationDays: updatedData.durationDays,
      isActive: updatedData.isActive,
      updateAt: updatedData.updateAt,
    });

    return updatedData;
  }

  validateSubscriptionPayload(subscription, isUpdate = false) {
    const {
      id,
      name,
      description,
      price,
      durationDays,
      isActive,
    } = subscription || {};

    if (!id || typeof id !== "string" || id.trim() === "") {
      throw new Error("Id subscription không hợp lệ");
    }

    if (!name || typeof name !== "string" || name.trim() === "") {
      throw new Error("Tên gói không hợp lệ");
    }

    if (id.trim().toLowerCase() === name.trim().toLowerCase()) {
      throw new Error("Id gói dịch vụ phải là mã định danh riêng biệt, không được trùng với tên gói");
    }

    if (description !== undefined && description !== null && typeof description !== "string") {
      throw new Error("Mô tả phải là chuỗi");
    }

    if (typeof price !== "number" || Number.isNaN(price) || price < 0) {
      throw new Error("Giá không hợp lệ, phải là số >= 0");
    }

    if (!Number.isInteger(durationDays) || durationDays <= 0) {
      throw new Error("durationDays phải là số nguyên > 0");
    }

    if (typeof isActive !== "boolean") {
      throw new Error("isActive phải là boolean");
    }
  }

  normalizeDateValue(value) {
    if (!value) return value;

    if (typeof value === "string") return value;
    if (value instanceof Date) return value.toISOString();
    if (typeof value.toDate === "function") return value.toDate().toISOString();

    return value;
  }
}

module.exports = new SubscriptionService();
