const admin = require("firebase-admin");

const normalizeDateValue = (value) => {
    if (!value) return value;

    if (typeof value === "string") return value;
    if (value instanceof Date) return value.toISOString();
    if (typeof value.toDate === "function") return value.toDate().toISOString();

    return value;
};

const getSubscriptionsPaging = async (req, res) => {
    try {
        const query = req.query.query || "";
        const key = parseInt(req.query.key, 10) || 0;
        const limit = parseInt(req.query.limit, 10) || 20;
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

        const subscriptions = subscriptionSnap.docs.map((subscription) => {
            const data = subscription.data();

            return {
                ...data,
                createAt: normalizeDateValue(data.createAt),
                updateAt: normalizeDateValue(data.updateAt),
            };
        });

        return res.status(200).json({
            subscriptions,
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message,
            subscriptions: [],
        });
    }
};

module.exports = {
    getSubscriptionsPaging,
};
