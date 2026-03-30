import { Admin } from "../../models/admin.model.js";

/**
 * 🔐 Change Password (NON-ADMIN USERS)
 * Route: PATCH /api/auth/change-password
 */
export const changePassword = async (req, res) => {
  try {
    // ✅ user comes from requireAuth middleware
    const authUser = req.user;

    /* =========================
       ❌ ADMIN NOT ALLOWED
    ========================= */
    if (authUser.role === "admin") {
      return res.status(403).json({
        error: "Admins are not allowed to change password here",
      });
    }

    const { oldPassword, newPassword } = req.body;

    /* =========================
       ⚠️ VALIDATION
    ========================= */
    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        error: "Old password and new password are required",
      });
    }

    /* =========================
       🔍 FETCH USER (WITH PASSWORD)
    ========================= */
    const user = await Admin.findOne({
      admin_id: authUser.admin_id,
      shop_domain: authUser.shop_domain, // 🔐 shop-level isolation
      is_active: true,
    }).select("+password");

    if (!user) {
      return res.status(404).json({
        error: "User not found for this shop",
      });
    }

    /* =========================
       🔑 VERIFY OLD PASSWORD
    ========================= */
    const isMatch = await user.comparePassword(oldPassword);

    if (!isMatch) {
      return res.status(401).json({
        error: "Old password is incorrect",
      });
    }

    /* =========================
       🔄 UPDATE PASSWORD
    ========================= */
    user.password = newPassword; // 🔥 hashed via pre-save hook
    user.must_change_password = false;

    await user.save();

    /* =========================
       ✅ RESPONSE
    ========================= */
    return res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Change Password Error:", error);

    return res.status(500).json({
      error: "Internal Server Error",
    });
  }
};
