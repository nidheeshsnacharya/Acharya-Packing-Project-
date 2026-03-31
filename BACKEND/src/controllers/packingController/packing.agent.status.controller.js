import { PackingScanLog } from "../../models/packingScanLog.model.js";

export async function getPackingAgentStats(req, res) {
  try {
    const user = req.user;

    // Only packing role
    if (user.role !== "packing") {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!user.shop_domain) {
      return res.status(400).json({ error: "User is not linked to any shop" });
    }

    const agentId = user.admin_id;
    const shopDomain = user.shop_domain;

    // Date ranges
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const endOfYesterday = new Date(endOfToday);
    endOfYesterday.setDate(endOfYesterday.getDate() - 1);

    // Helper to build stats for a given match condition
    const buildStats = async (match) => {
      const result = await PackingScanLog.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$sku",
            quantity: { $sum: 1 },
            orders: { $addToSet: "$order_name" },
          },
        },
        {
          $group: {
            _id: null,
            total_scans: { $sum: "$quantity" },
            sku_stats: {
              $push: {
                sku: "$_id",
                quantity: "$quantity",
              },
            },
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

    const baseMatch = {
      shop_domain: shopDomain,
      "scanned_by.admin_id": agentId,
    };

    const [today, yesterday, overall] = await Promise.all([
      buildStats({
        ...baseMatch,
        scanned_at: { $gte: startOfToday, $lte: endOfToday },
      }),
      buildStats({
        ...baseMatch,
        scanned_at: { $gte: startOfYesterday, $lte: endOfYesterday },
      }),
      buildStats(baseMatch),
    ]);

    return res.json({
      success: true,
      shop_domain: shopDomain,
      agent: {
        agent_id: user.admin_id,
        name: user.name,
        role: user.role,
      },
      today,
      yesterday,
      overall,
    });
  } catch (error) {
    console.error("Error fetching packing stats:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
