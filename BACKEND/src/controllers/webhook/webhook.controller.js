import { handleFulfillmentData } from "../../services/services.fulfillment.js";

/**
 * 🚚 POST /api/v1/webhooks/fulfillment
 * This controller handles the incoming Shopify payload AFTER
 * it has been verified by the verifyShopifyWebhook middleware.
 */
export const handleShopifyFulfillment = async (req, res) => {
  try {
    // 1. Extract data from headers and body
    const shopDomain = req.headers["x-shopify-shop-domain"];
    const payload = req.body;

    if (!payload || !shopDomain) {
      return res.status(400).json({ error: "Missing payload or shop domain" });
    }

    // 2. Process the fulfillment (Upsert to MongoDB)
    const result = await handleFulfillmentData(payload, shopDomain);

    console.log(`✅ Webhook Processed: Order ${payload.id} for ${shopDomain}`);

    // 3. Always respond with 200 OK to Shopify within 2 seconds
    return res.status(200).send("OK");
  } catch (error) {
    console.error("❌ Webhook Controller Error:", error);

    // We send a 500 so Shopify knows to retry if the DB was down
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
