import { Sku } from "../../models/sku.model.js";

/**
 * 🧨 Hard SKU Delete Controller
 * Route: DELETE /api/sku/delete
 * Roles: admin, logistics
 * Shop-scoped deletion only
 */
export const hardSkuDelete = async (req, res) => {
  try {
    const user = req.user; // populated by your auth middleware

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
       ⚠️ VALIDATION
    ========================= */
    const { sku } = req.body;
    if (!sku) {
      return res.status(400).json({ error: "SKU is required" });
    }

    // Always normalize to ensure we find the record regardless of case input
    const normalizedSku = sku.trim().toUpperCase();

    /* =========================
       🔎 FIND SKU (SHOP-SCOPED)
    ========================= */
    const skuDoc = await Sku.findOne({
      shop_domain: shopDomain,
      sku: normalizedSku,
    });

    if (!skuDoc) {
      return res.status(404).json({
        error: "SKU not found for this shop",
      });
    }

    /* =========================
       ❌ HARD DELETE
    ========================= */
    // Using both _id and shop_domain for absolute security
    await Sku.deleteOne({
      _id: skuDoc._id,
      shop_domain: shopDomain,
    });

    /* =========================
       ✅ RESPONSE
    ========================= */
    return res.status(200).json({
      success: true,
      message: "SKU permanently deleted",
      deleted_sku: normalizedSku,
      shop_domain: shopDomain,
      deleted_by: {
        admin_id: user.admin_id,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Hard SKU Delete Error:", error);
    return res.status(500).json({
      error: "Internal Server Error",
    });
  }
};
