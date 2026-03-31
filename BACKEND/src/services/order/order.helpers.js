import { Sku } from "../../models/sku.model.js";
import { Admin } from "../../models/admin.model.js";

// ------------------------------
// Helper Functions
// ------------------------------
export function determineScanStatus(allItemsScanned, trackingScanned) {
  if (allItemsScanned && trackingScanned) return "scanned";
  if (allItemsScanned && !trackingScanned) return "tracking_label_pending";
  if (!allItemsScanned && trackingScanned) return "items_scanned";
  return "pending";
}

export async function getSkuInfo(shopDomain) {
  const allSkus = await Sku.find({
    shop_domain: shopDomain,
    is_active: true,
  }).lean();
  const skuMap = new Map();
  const bundleMap = new Map();
  allSkus.forEach((sku) => {
    skuMap.set(sku.sku, sku);
    if (sku.sku_type === "bundle") bundleMap.set(sku.sku, sku);
  });
  return { skuMap, bundleMap };
}

export async function checkAllItemsScanned(order, shopDomain) {
  const { bundleMap } = await getSkuInfo(shopDomain);
  for (const item of order.line_items) {
    const bundleDoc = bundleMap.get(item.sku);
    if (bundleDoc && bundleDoc.bundle_items) {
      for (const bundleItem of bundleDoc.bundle_items) {
        const componentScans = item.component_scans?.[bundleItem.sku] || 0;
        const required = bundleItem.quantity * (item.quantity || 1);
        if (componentScans < required) return false;
      }
    } else {
      if ((item.scan?.scanned_qty || 0) < (item.quantity || 1)) return false;
    }
  }
  return true;
}

export async function expandLineItems(lineItems, shopDomain) {
  const { skuMap, bundleMap } = await getSkuInfo(shopDomain);
  const expandedItems = [];

  // Regular items first
  for (const item of lineItems) {
    const skuDoc = skuMap.get(item.sku);
    if (skuDoc?.sku_type === "bundle" && bundleMap.has(item.sku)) continue;
    const scannedQty = item.scan?.scanned_qty || 0;
    expandedItems.push({
      sku: item.sku,
      ordered_qty: item.quantity || 1,
      scanned_qty: scannedQty,
      pending_qty: Math.max(0, (item.quantity || 1) - scannedQty),
      fully_scanned: scannedQty >= (item.quantity || 1),
      product_name: skuDoc?.product_name || item.title || "Unknown Product",
      image_url: skuDoc?.image_url || null,
      is_bundle_component: false,
      source_info: {
        type: "regular",
        quantity: item.quantity || 1,
        line_item_id: item._id?.toString(),
        is_separate_order: true,
      },
    });
  }

  // Bundles
  for (const item of lineItems) {
    const skuDoc = skuMap.get(item.sku);
    if (skuDoc?.sku_type === "bundle" && bundleMap.has(item.sku)) {
      const bundleDoc = bundleMap.get(item.sku);
      const componentStatuses = [];
      let allComponentsFullyScanned = true;
      let totalComponentScannedCount = 0;
      let totalComponentRequiredCount = 0;

      for (const bundleItem of bundleDoc.bundle_items) {
        const componentScans = item.component_scans?.[bundleItem.sku] || 0;
        const required = bundleItem.quantity * (item.quantity || 1);
        const componentFullyScanned = componentScans >= required;
        if (!componentFullyScanned) allComponentsFullyScanned = false;
        totalComponentScannedCount += componentScans;
        totalComponentRequiredCount += required;
        componentStatuses.push({
          sku: bundleItem.sku,
          fully_scanned: componentFullyScanned,
          scanned_qty: componentScans,
          required_qty: required,
          pending_qty: Math.max(0, required - componentScans),
        });
      }

      const bundleScannedQty = allComponentsFullyScanned
        ? item.quantity || 1
        : 0;
      const bundlePendingQty = allComponentsFullyScanned
        ? 0
        : item.quantity || 1;

      expandedItems.push({
        sku: item.sku,
        ordered_qty: item.quantity || 1,
        scanned_qty: bundleScannedQty,
        pending_qty: bundlePendingQty,
        fully_scanned: allComponentsFullyScanned,
        product_name: skuDoc?.product_name || `Bundle ${item.sku}`,
        image_url: skuDoc?.image_url || null,
        is_bundle: true,
        is_bundle_component: false,
        bundle_components: componentStatuses,
        source_info: {
          type: "bundle_main",
          quantity: item.quantity || 1,
          line_item_id: item._id?.toString(),
        },
      });

      for (const bundleItem of bundleDoc.bundle_items) {
        const componentSku = bundleItem.sku;
        const componentDoc = skuMap.get(componentSku);
        const totalNeeded = bundleItem.quantity * (item.quantity || 1);
        const scannedFromBundle = item.component_scans?.[componentSku] || 0;

        expandedItems.push({
          sku: componentSku,
          ordered_qty: totalNeeded,
          scanned_qty: scannedFromBundle,
          pending_qty: Math.max(0, totalNeeded - scannedFromBundle),
          fully_scanned: scannedFromBundle >= totalNeeded,
          product_name:
            componentDoc?.product_name || `Component of ${item.sku}`,
          image_url: componentDoc?.image_url || null,
          is_bundle_component: true,
          source_info: {
            type: "bundle_component",
            bundle_sku: item.sku,
            bundle_name: skuDoc.product_name,
            bundle_quantity: item.quantity,
            component_quantity: bundleItem.quantity,
            parent_line_item_id: item._id?.toString(),
            from_bundle_only: true,
          },
        });
      }
    }
  }

  return expandedItems;
}

export async function calculateSkuQuantities(order, targetSku, shopDomain) {
  let required = 0;
  let scanned = 0;
  const sourceBreakdown = [];

  const allSkus = await Sku.find({
    shop_domain: shopDomain,
    is_active: true,
  }).lean();
  const bundleMap = new Map();
  allSkus.forEach((s) => {
    if (s.sku_type === "bundle") bundleMap.set(s.sku, s);
  });

  // Regular items
  for (const item of order.line_items) {
    if (item.sku === targetSku) {
      const itemRequired = item.quantity || 1;
      const itemScanned = item.scan?.scanned_qty || 0;
      required += itemRequired;
      scanned += itemScanned;
      sourceBreakdown.push({
        type: "regular",
        line_item_id: item._id?.toString(),
        quantity: itemRequired,
        scanned: itemScanned,
        pending: itemRequired - itemScanned,
        is_separate_order: true,
      });
    }
  }

  // Bundles
  for (const item of order.line_items) {
    const bundleDoc = bundleMap.get(item.sku);
    if (bundleDoc && bundleDoc.bundle_items) {
      const bundleComponent = bundleDoc.bundle_items.find(
        (bi) => bi.sku === targetSku,
      );
      if (bundleComponent) {
        const quantityFromBundle =
          bundleComponent.quantity * (item.quantity || 1);
        required += quantityFromBundle;
        const scansFromBundle = item.component_scans?.[targetSku] || 0;
        scanned += scansFromBundle;
        sourceBreakdown.push({
          type: "bundle_component",
          bundle_sku: item.sku,
          bundle_name: bundleDoc.product_name,
          line_item_id: item._id?.toString(),
          quantity: quantityFromBundle,
          scanned: scansFromBundle,
          pending: quantityFromBundle - scansFromBundle,
          component_quantity_per_bundle: bundleComponent.quantity,
          from_bundle_only: true,
        });
      }
    }
  }

  return {
    required,
    scanned,
    sourceBreakdown,
    fully_scanned: scanned >= required,
  };
}

export async function canScanComponent(order, componentSku, shopDomain) {
  // Check regular items first
  for (const item of order.line_items) {
    if (item.sku === componentSku) {
      const currentScans = item.scan?.scanned_qty || 0;
      if (currentScans < (item.quantity || 1)) {
        return { canScan: true, type: "regular", item };
      }
    }
  }

  // Check bundles
  const allBundles = await Sku.find({
    shop_domain: shopDomain,
    sku_type: "bundle",
    is_active: true,
  }).lean();
  for (const bundle of allBundles) {
    const bundleComponent = bundle.bundle_items?.find(
      (bi) => bi.sku === componentSku,
    );
    if (!bundleComponent) continue;
    const bundleItem = order.line_items.find((item) => item.sku === bundle.sku);
    if (!bundleItem) continue;
    bundleItem.component_scans = bundleItem.component_scans || {};
    const currentScans = bundleItem.component_scans[componentSku] || 0;
    const maxForBundle = bundleComponent.quantity * (bundleItem.quantity || 1);
    if (currentScans < maxForBundle) {
      return {
        canScan: true,
        type: "bundle_component",
        item: bundleItem,
        bundleSku: bundle.sku,
        componentSku,
      };
    }
  }

  return { canScan: false };
}
