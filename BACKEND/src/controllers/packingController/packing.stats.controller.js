import { PackingScanLog } from "../../models/packingScanLog.model.js";

export async function getPackingLeaderboard(req, res) {
  try {
    const user = req.user;

    // Role check (admin & logistics only)
    if (!["admin", "logistics"].includes(user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const shopDomain = user.shop_domain;

    if (!shopDomain) {
      return res.status(400).json({ error: "User is not linked to any shop" });
    }

    const stats = await PackingScanLog.aggregate([
      {
        $match: { shop_domain: shopDomain },
      },
      {
        $group: {
          _id: {
            admin_id: "$scanned_by.admin_id",
            sku: "$sku",
          },
          name: { $first: "$scanned_by.name" },
          role: { $first: "$scanned_by.role" },
          sku: { $first: "$sku" },
          sku_count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.admin_id",
          name: { $first: "$name" },
          role: { $first: "$role" },
          total_scans: { $sum: "$sku_count" },
          sku_stats: {
            $push: {
              sku: "$sku",
              count: "$sku_count",
            },
          },
        },
      },
      {
        $sort: { total_scans: -1 },
      },
    ]);

    return res.json({
      success: true,
      shop_domain: shopDomain,
      count: stats.length,
      stats,
    });
  } catch (error) {
    console.error("Error fetching packing status:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
