import { Admin } from "../../models/admin.model.js";

/**
 * 🔐 Reset Password
 * Route: PATCH /api/admin/reset-password
 *
 * - Admin → reset anyone in same shop
 * - Logistics / Packing → reset ONLY self
 */
export const changeAdminPass = async (req, res) => {
  try {
    const currentUser = req.user;

    const { newPassword, target_admin_id } = req.body;

    /* =========================
       🔴 VALIDATION
    ========================= */
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        error: "New password must be at least 6 characters long",
      });
    }

    const shopDomain = currentUser.shop_domain;

    if (!shopDomain) {
      return res.status(400).json({
        error: "User is not linked to any shop",
      });
    }

    let userToUpdate;

    /* =========================
       🔐 ADMIN RESET (SAME SHOP ONLY)
    ========================= */
    if (target_admin_id) {
      if (currentUser.role !== "admin") {
        return res.status(403).json({
          error: "Forbidden",
        });
      }

      userToUpdate = await Admin.findOne({
        admin_id: target_admin_id,
        is_active: true,
        $or: [
          { shop_domain: shopDomain },
          { "shopify.shop_domain": shopDomain },
        ],
      }).select("+password");
    } else {
      /* =========================
       🔐 SELF RESET (ANY ROLE)
    ========================= */
      userToUpdate = await Admin.findOne({
        admin_id: currentUser.admin_id,
        is_active: true,
      }).select("+password");
    }

    /* =========================
       ❌ USER NOT FOUND
    ========================= */
    if (!userToUpdate) {
      return res.status(404).json({
        error: "User not found for this shop",
      });
    }

    /* =========================
       🔑 UPDATE PASSWORD
    ========================= */
    userToUpdate.password = newPassword; // 🔥 hashed via pre-save hook
    userToUpdate.must_change_password = false;

    await userToUpdate.save();

    /* =========================
       ✅ RESPONSE
    ========================= */
    return res.status(200).json({
      success: true,
      updated_user: {
        admin_id: userToUpdate.admin_id,
        role: userToUpdate.role,
      },
    });
  } catch (error) {
    console.error("Reset Password Error:", error);

    return res.status(500).json({
      error: "Internal Server Error",
    });
  }
};
