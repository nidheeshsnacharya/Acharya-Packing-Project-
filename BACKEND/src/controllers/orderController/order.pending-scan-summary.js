import { Order } from "../../models/order.model.js";

export async function getPendingScanSummary(req, res) {
  try {
    const user = req.user; // from auth middleware

    // Role check (optional – you can keep or remove as needed)
    if (!["admin", "logistics"].includes(user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Shop safety
    if (!user.shop_domain) {
      return res.status(400).json({ error: "User is not linked to any shop" });
    }

    const result = await Order.aggregate([
      {
        $match: {
          shop_domain: user.shop_domain,
          scan_status: { $ne: "cancelled" },
        },
      },
      { $unwind: "$line_items" },
      {
        $addFields: {
          scanned_qty: {
            $ifNull: ["$line_items.scan.scanned_qty", 0],
          },
        },
      },
      {
        $group: {
          _id: "$line_items.sku",
          total_ordered: { $sum: "$line_items.quantity" },
          total_packed: { $sum: "$scanned_qty" },
          product_name: { $first: "$line_items.title" },
        },
      },
      {
        $addFields: {
          total_pending: {
            $max: [{ $subtract: ["$total_ordered", "$total_packed"] }, 0],
          },
        },
      },
      { $sort: { total_ordered: -1 } },
    ]);

    // Build response objects
    const ordered = {};
    const packed = {};
    const pending = {};
    const products = {};

    for (const row of result) {
      ordered[row._id] = row.total_ordered;
      packed[row._id] = row.total_packed;
      pending[row._id] = row.total_pending;
      products[row._id] = row.product_name || "";
    }

    return res.json({
      success: true,
      shop_domain: user.shop_domain,
      summary: { ordered, packed, pending, products },
    });
  } catch (error) {
    console.error("Error in quantity summary:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
