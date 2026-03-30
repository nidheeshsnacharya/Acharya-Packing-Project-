import { Admin } from "../../models/admin.model.js";

/**
 * DELETE LOGISTICS USER
 * Admin only
 * Same shop only
 */
export const deleteLogisticsUser = async (req, res) => {
  try {
    // 🔐 Auth (from middleware)
    const adminUser = req.user;

    // (Optional safety if not already handled in middleware)
    if (adminUser.role !== "admin") {
      return res.status(403).json({
        error: "Forbidden",
      });
    }

    if (!adminUser.shop_domain) {
      return res.status(400).json({
        error: "Admin is not linked to any shop",
      });
    }

    const { admin_id } = req.body;

    if (!admin_id) {
      return res.status(400).json({
        error: "admin_id is required",
      });
    }

    // 🔍 FIND LOGISTICS USER (SHOP-SCOPED)
    const user = await Admin.findOne({
      admin_id,
      role: "logistics",
      shop_domain: adminUser.shop_domain,
    });

    if (!user) {
      return res.status(404).json({
        error: "Logistics user not found for this shop",
      });
    }

    // 🧨 HARD DELETE
    await Admin.deleteOne({ _id: user._id });

    return res.status(200).json({
      success: true,
      message: "Logistics user deleted permanently",
      admin_id,
      shop_domain: adminUser.shop_domain,
    });
  } catch (error) {
    console.error("Delete Logistics Error:", error);

    return res.status(500).json({
      error: "Internal Server Error",
    });
  }
};
