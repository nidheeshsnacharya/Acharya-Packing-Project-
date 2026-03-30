import { Sku } from "../../models/sku.model.js";

/**
 * 🧨 Delete SKU (Hard Delete)
 * Route: DELETE /api/sku/delete
 * 🔐 Admin & Logistics only
 * 🛡️ Shop-scoped deletion for safety
 */
export const deleteSku = async (req, res) => {
  try {
    const user = req.user;

    /* =========================
       🔐 ROLE CHECK
    ========================= */
    if (!["admin", "logistics"].includes(user.role)) {
      return res.status(403).json({
        error: "Forbidden",
      });
    }

    /* =========================
       🏬 SHOP CONTEXT
    ========================= */
    const shopDomain = user.shop_domain?.trim().toLowerCase();

    if (!shopDomain) {
      return res.status(400).json({
        error: "User is not linked to any shop",
      });
    }

    const { sku } = req.body;

    /* =========================
       ⚠️ VALIDATION
    ========================= */
    if (!sku) {
      return res.status(400).json({
        error: "SKU is required",
      });
    }

    // Normalize to match how SKUs are stored during creation
    const normalizedSku = sku.trim().toUpperCase();

    /* =========================
       🔍 FIND SKU (SHOP-SCOPED)
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
       🧨 HARD DELETE (SAFE)
    ========================= */
    // We include shop_domain in the delete filter as a double-safety measure
    await Sku.deleteOne({
      _id: skuDoc._id,
      shop_domain: shopDomain,
    });

    /* =========================
       ✅ RESPONSE
    ========================= */
    return res.status(200).json({
      success: true,
      message: "SKU deleted permanently",
      sku: normalizedSku,
      shop_domain: shopDomain,
      deleted_by: {
        admin_id: user.admin_id,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Delete SKU Error:", error);

    return res.status(500).json({
      error: "Internal Server Error",
    });
  }
};
