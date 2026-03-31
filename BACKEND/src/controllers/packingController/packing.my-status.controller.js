import { PackingScanLog } from "../../models/packingScanLog.model.js";

export async function getPackingStatsSimple(req, res) {
  try {
    const user = req.user;

    // Only packing role
    if (user.role !== "packing") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const agentId = user.admin_id;
    const shopDomain = user.shop_domain;

    if (!shopDomain) {
      return res.status(400).json({ error: "User is not linked to any shop" });
    }

    // Date range for today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // Helper to run aggregation
    const runAggregation = async (match) => {
      const result = await PackingScanLog.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$sku",
            sku_count: { $sum: 1 },
            orders: { $addToSet: "$order_name" },
          },
        },
        {
          $group: {
            _id: null,
            total_scans: { $sum: "$sku_count" },
            sku_stats: { $push: { sku: "$_id", count: "$sku_count" } },
            all_orders: { $push: "$orders" },
          },
        },
        {
          $project: {
            _id: 0,
            total_scans: 1,
            total_orders: { $size: { $setUnion: "$all_orders" } },
            sku_stats: 1,
          },
        },
      ]);
      return result[0] || { total_scans: 0, total_orders: 0, sku_stats: [] };
    };

    // Today's stats
    const todayMatch = {
      shop_domain: shopDomain,
      "scanned_by.admin_id": agentId,
      scanned_at: { $gte: startOfToday, $lte: endOfToday },
    };
    const todayStatsRaw = await runAggregation(todayMatch);
    const todayStats = {
      date: new Date().toISOString().slice(0, 10),
      total_scans: todayStatsRaw.total_scans,
      total_orders: todayStatsRaw.total_orders,
      sku_stats: todayStatsRaw.sku_stats,
    };

    // Overall stats (all time)
    const overallMatch = {
      shop_domain: shopDomain,
      "scanned_by.admin_id": agentId,
    };
    const overallStats = await runAggregation(overallMatch);

    return res.json({
      success: true,
      agent: {
        agent_id: user.admin_id,
        name: user.name,
        role: user.role,
        shop_domain: shopDomain,
      },
      today: todayStats,
      overall: overallStats,
    });
  } catch (error) {
    console.error("Error fetching packing stats:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
