import { Order } from "../../models/order.model.js";
import { PackingScanLog } from "../../models/packingScanLog.model.js";

export async function deleteOrders(req, res) {
  try {
    const user = req.user; // Assumes auth middleware sets this

    // Role check (admin or logistics only)
    if (!["admin", "logistics"].includes(user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Shop safety
    if (!user.shop_domain) {
      return res.status(400).json({ error: "User is not linked to any shop" });
    }

    const { order_name, order_names } = req.body;

    // Bulk delete
    if (Array.isArray(order_names) && order_names.length > 0) {
      // Find orders to get IDs
      const ordersToDelete = await Order.find({
        order_name: { $in: order_names },
        shop_domain: user.shop_domain,
      });

      const orderIds = ordersToDelete.map((order) => order._id);

      // Delete associated logs
      const logDeleteResult = await PackingScanLog.deleteMany({
        shop_domain: user.shop_domain,
        order_id: { $in: orderIds },
      });

      // Delete orders
      const orderDeleteResult = await Order.deleteMany({
        order_name: { $in: order_names },
        shop_domain: user.shop_domain,
      });

      return res.json({
        success: true,
        message: "Orders and associated packing logs permanently deleted",
        deleted_orders: orderDeleteResult.deletedCount,
        deleted_logs: logDeleteResult.deletedCount,
        requested_orders: order_names,
      });
    }

    // Single delete
    if (!order_name) {
      return res.status(400).json({
        error: "order_name or order_names[] is required",
      });
    }

    const order = await Order.findOne({
      order_name,
      shop_domain: user.shop_domain,
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found for this shop" });
    }

    // Delete logs first
    const logDeleteResult = await PackingScanLog.deleteMany({
      shop_domain: user.shop_domain,
      order_id: order._id,
    });

    // Delete order
    await Order.deleteOne({ _id: order._id });

    return res.json({
      success: true,
      message: "Order and associated packing logs permanently deleted",
      deleted_order: order_name,
      deleted_logs: logDeleteResult.deletedCount,
    });
  } catch (error) {
    console.error("Order deletion error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
