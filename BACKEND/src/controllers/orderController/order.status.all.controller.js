import { Order } from "../../models/order.model.js";

/**
 * Helper: Get stats for a specific time range (today or yesterday)
 */
async function getStatsForRange(shop_domain, start, end, label) {
  const matchStage = {
    shop_domain,
    createdAt: { $gte: start, $lt: end },
  };

  // Order counts via facet
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
    day: label,
    date: start.toISOString().slice(0, 10),
    orders: {
      total: orderCounts[0]?.total?.[0]?.count || 0,
      pending: orderCounts[0]?.pending?.[0]?.count || 0,
      scanned: orderCounts[0]?.scanned?.[0]?.count || 0,
      cancelled: orderCounts[0]?.cancelled?.[0]?.count || 0,
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
 * Helper: Get overall stats (all time)
 */
async function getOverallStats(shop_domain) {
  const matchStage = { shop_domain };

  // Order counts
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
    day: "overall",
    date: "all-time",
    orders: {
      total: orderCounts[0]?.total?.[0]?.count || 0,
      pending: orderCounts[0]?.pending?.[0]?.count || 0,
      scanned: orderCounts[0]?.scanned?.[0]?.count || 0,
      cancelled: orderCounts[0]?.cancelled?.[0]?.count || 0,
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
 * Main controller: get today's, yesterday's, and overall stats
 */
export async function getOrderStats(req, res) {
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

    // Date setup
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    // Run all queries in parallel
    const [today, yesterday, overall] = await Promise.all([
      getStatsForRange(user.shop_domain, todayStart, tomorrowStart, "today"),
      getStatsForRange(
        user.shop_domain,
        yesterdayStart,
        todayStart,
        "yesterday",
      ),
      getOverallStats(user.shop_domain),
    ]);

    return res.json({
      success: true,
      shop_domain: user.shop_domain,
      summary: { today, yesterday, overall },
    });
  } catch (error) {
    console.error("Error in order stats:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
