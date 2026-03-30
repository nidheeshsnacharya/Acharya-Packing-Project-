import { Admin } from "../models/admin.model.js";

const webhookSecrets = new Map();
let cacheInitialized = false; // 🟢 important

export const normalizeShopDomain = (domain) => {
  if (!domain) return "";
  return domain
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .toLowerCase();
};

/**
 * 🔄 Load cache from DB
 */
export const loadWebhookSecrets = async () => {
  try {
    const admins = await Admin.find({
      role: "admin",
      is_active: true,
      "shopify.shop_domain": { $exists: true },
      "shopify.webhook_secret": { $exists: true },
    }).select("+shopify.webhook_secret shopify.shop_domain");

    webhookSecrets.clear();

    admins.forEach((admin) => {
      const normalized = normalizeShopDomain(admin.shopify.shop_domain);

      if (normalized && admin.shopify.webhook_secret) {
        webhookSecrets.set(normalized, admin.shopify.webhook_secret);
      }
    });

    cacheInitialized = true; // ✅ mark loaded

    console.log("🧠 Webhook Cache Loaded:", [...webhookSecrets.keys()]);
  } catch (error) {
    console.error("❌ Cache Load Failed:", error);
  }
};

/**
 * 🟡 Lazy init (important for first request)
 */
export const ensureWebhookSecrets = async () => {
  if (!cacheInitialized) {
    await loadWebhookSecrets();
  }
};

/**
 * 🔁 Refresh cache (VERY IMPORTANT)
 */
export const refreshWebhookSecrets = async () => {
  try {
    console.log("🔁 Refreshing webhook cache...");

    cacheInitialized = false; // reset
    await loadWebhookSecrets();

    console.log("✅ Webhook cache refreshed");
  } catch (error) {
    console.error("❌ Cache Refresh Failed:", error);
  }
};

/**
 * 🔐 Get secret
 */
export const getWebhookSecret = async (shopDomain) => {
  await ensureWebhookSecrets(); // ✅ ensures cache exists

  return webhookSecrets.get(normalizeShopDomain(shopDomain));
};
