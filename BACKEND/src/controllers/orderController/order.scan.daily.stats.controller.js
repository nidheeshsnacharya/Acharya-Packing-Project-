import { PackingScanLog } from "../../models/packingScanLog.model.js";

export async function getOrderDailyScanStats(req, res) {
  try {
    const user = req.user;

    // Admin & Logistics only
    if (!["admin", "logistics"].includes(user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const shopDomain = user.shop_domain;
    if (!shopDomain) {
      return res.status(400).json({ error: "User is not linked to any shop" });
    }

    // Date range: today (server time)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const stats = await PackingScanLog.aggregate([
      {
        $match: {
          shop_domain: shopDomain,
          scanned_at: { $gte: startOfToday, $lte: endOfToday },
        },
      },
      // Group by agent + sku
      {
        $group: {
          _id: { agent_id: "$scanned_by.admin_id", sku: "$sku" },
          agent_name: { $first: "$scanned_by.name" },
          role: { $first: "$scanned_by.role" },
          sku_count: { $sum: 1 },
          orders: { $addToSet: "$order_name" },
        },
      },
      // Group by agent
      {
        $group: {
          _id: "$_id.agent_id",
          agent_name: { $first: "$agent_name" },
          role: { $first: "$role" },
          total_scans: { $sum: "$sku_count" },
          all_orders: { $push: "$orders" },
          sku_stats: {
            $push: {
              sku: "$_id.sku",
              count: "$sku_count",
            },
          },
        },
      },
      // Final shape
      {
        $project: {
          _id: 0,
          date: { $dateToString: { format: "%Y-%m-%d", date: new Date() } },
          agent_id: "$_id",
          agent_name: 1,
          role: 1,
          total_scans: 1,
          total_orders: { $size: { $setUnion: "$all_orders" } },
          sku_stats: 1,
        },
      },
      // Sort by total scans descending
      { $sort: { total_scans: -1 } },
    ]);

    return res.json({
      success: true,
      shop_domain: shopDomain,
      count: stats.length,
      stats,
    });
  } catch (error) {
    console.error("Error fetching today packing stats:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
