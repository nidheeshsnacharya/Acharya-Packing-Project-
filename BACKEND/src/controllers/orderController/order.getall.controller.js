import { PackingScanLog } from "../../models/packingScanLog.model.js";
import { Sku } from "../../models/sku.model.js";
import { Order } from "../../models/order.model.js";

/**
 * GET /api/orders/all
 * Returns ALL orders with bundle expansion, component tracking, and audit logs.
 */
export const getAllOrders = async (req, res) => {
  try {
    const user = req.user;

    // 🔐 ROLE CHECK
    if (!["admin", "logistics"].includes(user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // 🔐 SHOP CHECK
    if (!user.shop_domain) {
      return res.status(400).json({
        error: "User is not linked to any shop",
      });
    }

    // 📦 FETCH ORDERS (SHOP SAFE)
    const orders = await Order.find({
      shop_domain: user.shop_domain,
    })
      .sort({ createdAt: -1 })
      .lean();

    // 📦 FETCH ALL SKUS FOR THIS SHOP TO GET BUNDLE INFORMATION
    const allSkus = await Sku.find({
      shop_domain: user.shop_domain,
      is_active: true,
    }).lean();

    // Create maps for quick lookup
    const skuMap = new Map();
    const bundleMap = new Map();

    allSkus.forEach((sku) => {
      skuMap.set(sku.sku, sku);
      if (sku.sku_type === "bundle") {
        bundleMap.set(sku.sku, sku);
      }
    });

    // 🧾 FETCH PACKING LOGS (SHOP SAFE)
    const orderIds = orders.map((o) => o._id);

    const logs = await PackingScanLog.find({
      shop_domain: user.shop_domain,
      order_id: { $in: orderIds },
    })
      .sort({ scanned_at: -1 })
      .lean();

    // 🧠 GROUP LOGS BY ORDER
    const logsByOrder = {};
    for (const log of logs) {
      const id = log.order_id.toString();
      if (!logsByOrder[id]) logsByOrder[id] = [];
      logsByOrder[id].push(log);
    }

    /* ==============================
        HELPERS
    ============================== */

    function expandLineItems(lineItems) {
      const expandedItems = [];

      for (const item of lineItems) {
        const skuDoc = skuMap.get(item.sku);

        if (skuDoc?.sku_type === "bundle" && bundleMap.has(item.sku)) {
          const bundleDoc = bundleMap.get(item.sku);

          const componentStatuses = [];
          let allComponentsScanned = true;
          let totalScannedComponents = 0;
          let totalRequiredComponents = 0;

          for (const bundleItem of bundleDoc.bundle_items || []) {
            const componentScans = item.component_scans?.[bundleItem.sku] || 0;
            const requiredFromBundle =
              bundleItem.quantity * (item.quantity || 1);
            const componentScanned = componentScans >= requiredFromBundle;

            if (!componentScanned) allComponentsScanned = false;

            totalScannedComponents += componentScans;
            totalRequiredComponents += requiredFromBundle;

            const componentDoc = skuMap.get(bundleItem.sku);

            componentStatuses.push({
              sku: bundleItem.sku,
              title: componentDoc?.product_name || `Component of ${item.sku}`,
              product_name:
                componentDoc?.product_name || `Component of ${item.sku}`,
              image_url: componentDoc?.image_url || null,
              scanned: componentScanned,
              scanned_qty: componentScans,
              required_qty: requiredFromBundle,
              pending_qty: Math.max(0, requiredFromBundle - componentScans),
              fully_scanned: componentScanned,
              quantity_per_bundle: bundleItem.quantity,
            });
          }

          expandedItems.push({
            sku: item.sku,
            quantity: item.quantity || 1,
            ordered_qty: item.quantity || 1,
            scanned_qty: allComponentsScanned ? item.quantity || 1 : 0,
            pending_qty: allComponentsScanned ? 0 : item.quantity || 1,
            fully_scanned: allComponentsScanned,
            product_name: skuDoc?.product_name || `Bundle ${item.sku}`,
            title: skuDoc?.product_name || `Bundle ${item.sku}`,
            image_url: skuDoc?.image_url || null,
            is_bundle: true,
            bundle_components: componentStatuses,
            component_scans: item.component_scans || {},
            scan: {
              scanned_qty: totalScannedComponents,
              total_qty: totalRequiredComponents,
              fully_scanned: allComponentsScanned,
            },
            original_line_item: {
              id: item._id,
              price: item.price,
              title: item.title,
            },
          });
        } else {
          expandedItems.push({
            sku: item.sku,
            quantity: item.quantity || 1,
            ordered_qty: item.quantity || 1,
            scanned_qty: item.scan?.scanned_qty || 0,
            pending_qty: Math.max(
              0,
              (item.quantity || 1) - (item.scan?.scanned_qty || 0),
            ),
            fully_scanned:
              (item.scan?.scanned_qty || 0) >= (item.quantity || 1),
            product_name:
              skuDoc?.product_name || item.title || "Unknown Product",
            title: skuDoc?.product_name || item.title || "Unknown Product",
            image_url: skuDoc?.image_url || null,
            is_bundle: false,
            scan: item.scan || { scanned_qty: 0 },
            original_line_item: {
              id: item._id,
              price: item.price,
              title: item.title,
            },
          });
        }
      }
      return expandedItems;
    }

    function checkAllItemsScanned(order) {
      for (const item of order.line_items || []) {
        const skuDoc = skuMap.get(item.sku);
        if (skuDoc?.sku_type === "bundle" && bundleMap.has(item.sku)) {
          const bundleDoc = bundleMap.get(item.sku);
          for (const bundleItem of bundleDoc.bundle_items || []) {
            const componentScans = item.component_scans?.[bundleItem.sku] || 0;
            const requiredFromBundle =
              bundleItem.quantity * (item.quantity || 1);
            if (componentScans < requiredFromBundle) return false;
          }
        } else {
          if ((item.scan?.scanned_qty || 0) < (item.quantity || 1))
            return false;
        }
      }
      return true;
    }

    /* ==============================
        FINAL ENRICHMENT
    ============================== */

    const enrichedOrders = orders.map((order) => {
      const expandedItems = expandLineItems(order.line_items || []);
      const allItemsScanned = checkAllItemsScanned(order);
      const trackingScanned = order.tracking?.scan_status === "scanned";

      let totalOrdered = 0;
      let totalScanned = 0;

      expandedItems.forEach((item) => {
        if (!item.is_bundle) {
          totalOrdered += item.ordered_qty || 0;
          totalScanned += item.scanned_qty || 0;
        }
      });

      const progress =
        totalOrdered > 0 ? Math.round((totalScanned / totalOrdered) * 100) : 0;

      return {
        ...order,
        expanded_items: expandedItems,
        scan_progress: {
          all_items_scanned: allItemsScanned,
          tracking_scanned: trackingScanned,
          order_complete: allItemsScanned && trackingScanned,
          total_items: expandedItems.filter((i) => !i.is_bundle).length,
          scanned_items: expandedItems.filter(
            (i) => i.fully_scanned && !i.is_bundle,
          ).length,
          progress_percentage: progress,
          total_ordered: totalOrdered,
          total_scanned: totalScanned,
        },
        packing_logs: logsByOrder[order._id.toString()] || [],
      };
    });

    return res.status(200).json({
      success: true,
      shop_domain: user.shop_domain,
      total: enrichedOrders.length,
      orders: enrichedOrders,
    });
  } catch (err) {
    console.error("Fetch Orders Error:", err);
    return res.status(500).json({
      error: err.message || "Internal Server Error",
    });
  }
};
