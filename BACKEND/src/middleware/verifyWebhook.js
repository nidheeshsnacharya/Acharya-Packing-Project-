import crypto from "crypto";
import { getWebhookSecret } from "../utils/shopifyWebhook.cache.js";

export const verifyShopifyWebhook = (req, res, next) => {
  const hmac = req.headers["x-shopify-hmac-sha256"];
  const shop = req.headers["x-shopify-shop-domain"];

  const secret = getWebhookSecret(shop);
  if (!hmac || !secret) return res.status(401).send("Unauthorized");

  const generatedHash = crypto
    .createHmac("sha256", secret)
    .update(req.rawBody, "utf8")
    .digest("base64");

  if (crypto.timingSafeEqual(Buffer.from(generatedHash), Buffer.from(hmac))) {
    next();
  } else {
    res.status(401).send("Forbidden");
  }
};
