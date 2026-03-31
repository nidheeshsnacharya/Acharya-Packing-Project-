import { Order } from "../../models/order.model.js";
import { PackingScanLog } from "../../models/packingScanLog.model.js";

export async function scanSku(req, res) {
  try {
    const user = req.user; // from auth middleware

    // Role check (admin, logistics, packing)
    if (!["admin", "logistics", "packing"].includes(user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Shop safety
    if (!user.shop_domain) {
      return res.status(400).json({ error: "User is not linked to any shop" });
    }

    const { order_name, sku } = req.body;

    if (!order_name || !sku) {
      return res.status(400).json({ error: "order_name and sku are required" });
    }

    // Find order (shop-scoped)
    const order = await Order.findOne({
      order_name,
      shop_domain: user.shop_domain,
    }).lean();

    if (!order) {
      return res.status(404).json({ error: "Order not found for this shop" });
    }

    // Find item index
    const itemIndex = order.line_items.findIndex((i) => i.sku === sku);
    if (itemIndex === -1) {
      return res.status(400).json({ error: "SKU not part of order" });
    }

    const item = order.line_items[itemIndex];
    // Initialize scan object if missing
    if (!item.scan) {
      item.scan = { scanned_qty: 0 };
    }

    if (item.scan.scanned_qty >= item.quantity) {
      return res.status(409).json({ error: "SKU already fully scanned" });
    }

    // Increment scan
    item.scan.scanned_qty += 1;
    item.scan.last_scanned_at = new Date();

    // Check if all items are scanned
    const allItemsScanned = order.line_items.every(
      (li) => (li.scan?.scanned_qty || 0) >= li.quantity,
    );

    const trackingScanned = order.tracking?.scan_status === "scanned";

    // Determine new order scan status
    let newScanStatus = "pending";
    if (allItemsScanned && trackingScanned) {
      newScanStatus = "scanned";
    } else if (allItemsScanned) {
      newScanStatus = "items_scanned";
    }

    // Prepare update
    const update = {
      $set: {
        line_items: order.line_items,
        scan_status: newScanStatus,
        updatedAt: new Date(),
      },
      $push: {
        scan_logs: {
          agent_id: user.admin_id,
          agent_name: user.name || "Unknown",
          role: user.role,
          sku,
          scan_type: "sku",
          scanned_at: new Date(),
        },
      },
    };

    // If status becomes "scanned", set scanned_at and scanned_by
    if (newScanStatus === "scanned") {
      update.$set.scanned_at = new Date();
      update.$set.scanned_by = {
        agent_id: user.admin_id,
        agent_name: user.name || "Unknown",
        role: user.role,
      };
    }

    // Perform update
    await Order.updateOne({ _id: order._id }, update);

    // Create scan log for statistics
    await PackingScanLog.create({
      shop_domain: user.shop_domain,
      order_name,
      sku,
      scan_type: "sku",
      scanned_by: {
        admin_id: user.admin_id,
        name: user.name || "Unknown",
        role: user.role,
      },
      scanned_at: new Date(),
    });

    // Return success with counts
    return res.json({
      success: true,
      status: newScanStatus,
      scanned_qty: item.scan.scanned_qty,
      ordered_qty: item.quantity,
      pending_qty: item.quantity - item.scan.scanned_qty,
    });
  } catch (error) {
    console.error("Error scanning SKU:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
