import { Order } from "../../models/order.model.js";

export async function getCancelledOrders(req, res) {
  try {
    const user = req.user;

    // Role check
    if (!["admin", "logistics"].includes(user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Shop safety
    if (!user.shop_domain) {
      return res.status(400).json({ error: "User is not linked to any shop" });
    }

    // Fetch cancelled orders for this shop
    const orders = await Order.find({
      shop_domain: user.shop_domain,
      scan_status: "cancelled",
    })
      .sort({ updatedAt: -1 })
      .lean();

    return res.json({
      success: true,
      shop_domain: user.shop_domain,
      count: orders.length,
      orders,
    });
  } catch (error) {
    console.error("Error fetching cancelled orders:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
