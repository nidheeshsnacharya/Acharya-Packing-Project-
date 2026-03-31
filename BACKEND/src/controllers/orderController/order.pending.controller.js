import { Order } from "../../models/order.model.js";

export async function getPendingOrders(req, res) {
  try {
    const user = req.user;

    if (!["admin", "logistics"].includes(user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!user.shop_domain) {
      return res.status(400).json({ error: "User is not linked to any shop" });
    }

    const orders = await Order.find({
      shop_domain: user.shop_domain,
      scan_status: "pending",
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
    console.error("Error fetching pending orders:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
