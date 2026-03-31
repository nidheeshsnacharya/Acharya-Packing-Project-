import { Order } from "../../models/order.model.js";

/**
 * Helper: Build stats for a given time range
 */
async function buildStats(shop_domain, start, end, label) {
  const matchStage = {
    shop_domain,
    createdAt: { $gte: start, $lt: end },
  };

  // Order counts (facet)
  const orderCounts = await Order.aggregate([
    { $match: matchStage },
    {
      $facet: {
        total: [{ $count: "count" }],
        pending: [{ $match: { scan_status: "pending" } }, { $count: "count" }],
        scanned: [{ $match: { scan_status: "scanned" } }, { $count: "count" }],
        cancelled: [
          { $match: { fulfillment_status: "cancelled" } },
          { $count: "count" },
        ],
      },
    },
  ]);

  const counts = orderCounts[0] || {};

  // SKU stats
  const skuStats = await Order.aggregate([
    { $match: matchStage },
    { $unwind: "$line_items" },
    {
      $group: {
        _id: "$line_items.sku",
        ordered_qty: { $sum: "$line_items.quantity" },
        scanned_qty: {
          $sum: {
            $cond: [
              { $eq: ["$scan_status", "scanned"] },
              "$line_items.quantity",
              0,
            ],
          },
        },
      },
    },
    { $sort: { ordered_qty: -1 } },
  ]);

  let totalOrderedQty = 0;
  let totalScannedQty = 0;
  for (const s of skuStats) {
    totalOrderedQty += s.ordered_qty;
    totalScannedQty += s.scanned_qty;
  }

  const topSku = skuStats[0] || null;

  return {
    success: true,
    shop_domain,
    day: label,
    date: start.toISOString().slice(0, 10),
    orders: {
      total: counts.total?.[0]?.count || 0,
      pending: counts.pending?.[0]?.count || 0,
      scanned: counts.scanned?.[0]?.count || 0,
      cancelled: counts.cancelled?.[0]?.count || 0,
    },
    sku: {
      total_ordered_quantity: totalOrderedQty,
      total_scanned_quantity: totalScannedQty,
      top_ordered_sku: topSku
        ? { sku: topSku._id, quantity: topSku.ordered_qty }
        : null,
      breakdown: skuStats.map((s) => ({
        sku: s._id,
        ordered_quantity: s.ordered_qty,
        scanned_quantity: s.scanned_qty,
      })),
    },
  };
}

/**
 * Main controller: get today's order statistics
 */
export async function getTodayStats(req, res) {
  try {
    const user = req.user;

    // Role check (admin & logistics only)
    if (!["admin", "logistics"].includes(user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Shop safety
    if (!user.shop_domain) {
      return res.status(400).json({ error: "User is not linked to any shop" });
    }

    // Today's date range
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const result = await buildStats(user.shop_domain, start, end, "today");
    return res.json(result);
  } catch (error) {
    console.error("Error fetching today stats:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
