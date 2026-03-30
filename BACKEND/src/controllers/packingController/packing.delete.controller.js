import { Admin } from "../../models/admin.model.js";

/**
 * DELETE PACKING USER
 * Admin & Logistics
 * Same shop only
 */
export const deletePackingUser = async (req, res) => {
  try {
    // 🔐 Auth (from middleware)
    const currentUser = req.user;

    if (!["admin", "logistics"].includes(currentUser.role)) {
      return res.status(403).json({
        error: "Forbidden",
      });
    }

    const { admin_id } = req.body;

    if (!admin_id) {
      return res.status(400).json({
        error: "admin_id is required",
      });
    }

    // 🏬 CURRENT USER SHOP
    const shopDomain = currentUser.shop_domain;

    if (!shopDomain) {
      return res.status(400).json({
        error: "User is not linked to any shop",
      });
    }

    // 🔍 FIND PACKING USER (SAME SHOP ONLY)
    const packingUser = await Admin.findOne({
      admin_id,
      role: "packing",
      shop_domain: shopDomain,
      is_active: true,
    });

    if (!packingUser) {
      return res.status(404).json({
        error: "Packing user not found for this shop",
      });
    }

    // 🧨 HARD DELETE
    await Admin.deleteOne({ _id: packingUser._id });

    return res.status(200).json({
      success: true,
      message: "Packing user deleted successfully",
      deleted_admin_id: admin_id,
      shop_domain: shopDomain,
    });
  } catch (error) {
    console.error("Delete Packing Error:", error);

    return res.status(500).json({
      error: "Internal Server Error",
    });
  }
};
