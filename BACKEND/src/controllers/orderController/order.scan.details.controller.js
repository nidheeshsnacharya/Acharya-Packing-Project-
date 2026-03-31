import { Order } from "../../models/order.model.js";
import { Sku } from "../../models/sku.model.js";

export async function getScanDetails(req, res) {
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

    // Get query parameter
    let orderBarcode = req.query.order_barcode;
    if (!orderBarcode) {
      return res.status(400).json({ error: "order_barcode is required" });
    }

    // Normalize barcode
    orderBarcode = orderBarcode.startsWith("#")
      ? orderBarcode
      : `#${orderBarcode}`;

    // Find order (shop‑scoped)
    const order = await Order.findOne({
      order_name: orderBarcode,
      shop_domain: user.shop_domain,
    }).lean();

    if (!order) {
      return res.status(404).json({ error: "Order not found for this shop" });
    }

    // Collect SKU codes from line_items
    const skuCodes = order.line_items.map((item) => item.sku).filter(Boolean);

    // Fetch active SKUs
    const skus = await Sku.find({
      sku: { $in: skuCodes },
      is_active: true,
    }).lean();

    const skuMap = Object.fromEntries(skus.map((s) => [s.sku, s]));

    // Enrich items with product details
    const items = order.line_items.map((item) => {
      const scannedQty = item.scan?.scanned_qty || 0;
      return {
        sku: item.sku,
        ordered_qty: item.quantity,
        scanned_qty: scannedQty,
        pending_qty: item.quantity - scannedQty,
        product_name: skuMap[item.sku]?.product_name || item.title || "",
        image_url: skuMap[item.sku]?.image_url || null,
      };
    });

    // Build response
    const response = {
      success: true,
      shop_domain: user.shop_domain,
      order: {
        order_name: order.order_name,
        order_id: order.orderId,
        scan_status: order.scan_status,
        customer: order.customer,
        tracking: order.tracking,
        items,
      },
    };

    return res.json(response);
  } catch (error) {
    console.error("Error in getScanDetails:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
