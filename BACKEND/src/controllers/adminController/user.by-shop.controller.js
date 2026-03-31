import { Admin } from "../../models/admin.model.js";

export async function getUsersByShop(req, res) {
  try {
    const user = req.user;

    // Role check
    if (!["admin", "logistics"].includes(user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const shopDomain = user.shop_domain;
    if (!shopDomain) {
      return res.status(400).json({ error: "User is not linked to any shop" });
    }

    // Query users in the same shop (compatible with both legacy and new structure)
    const users = await Admin.find(
      {
        is_active: true,
        $or: [
          { shop_domain: shopDomain },
          { "shopify.shop_domain": shopDomain },
        ],
      },
      {
        admin_id: 1,
        name: 1,
        email: 1,
        role: 1,
        createdAt: 1,
      },
    ).sort({ role: 1, createdAt: -1 });

    return res.json({
      success: true,
      shop_domain: shopDomain,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("Error fetching users by shop:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
