import { Sku } from "../../models/sku.model.js";

/**
 * 📝 List SKUs Controller
 * Route: GET /api/sku/list
 * Roles: admin, logistics
 * Returns active SKUs for the logged-in user's shop
 * Supports simple & bundle SKUs
 */
export const listSkus = async (req, res) => {
  try {
    const user = req.user; // Populated by your auth middleware (e.g., requireAuth)

    /* =========================
       🔐 ROLE CHECK
    ========================= */
    if (!["admin", "logistics"].includes(user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    /* =========================
       🏬 SHOP CONTEXT
    ========================= */
    const shopDomain = user.shop_domain?.trim().toLowerCase();
    if (!shopDomain) {
      return res.status(400).json({ error: "User is not linked to any shop" });
    }

    /* =========================
       🔍 FETCH ACTIVE SKUs (SHOP-SCOPED)
    ========================= */
    // Fetch only active SKUs belonging to the current user's shop
    const skus = await Sku.find(
      {
        shop_domain: shopDomain,
        is_active: true,
      },
      {
        _id: 0, // Exclude MongoDB ID
        sku: 1, // Include SKU code
        product_name: 1, // Include Product Name
        image_url: 1, // Include Image
        sku_type: 1, // 🔥 Explicitly include type (simple/bundle)
        bundle_items: 1, // 🔥 Explicitly include component list
        createdAt: 1, // Include creation date
      },
    ).sort({ createdAt: -1 }); // Sort by newest first

    /* =========================
       ✅ RESPONSE
    ========================= */
    return res.status(200).json({
      success: true,
      shop_domain: shopDomain,
      count: skus.length,
      skus,
    });
  } catch (error) {
    console.error("List SKUs Error:", error);
    return res.status(500).json({
      error: "Internal Server Error",
    });
  }
};
