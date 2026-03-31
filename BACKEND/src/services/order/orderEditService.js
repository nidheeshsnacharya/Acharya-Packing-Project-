import { Order } from "../../models/order.model.js";
import { PackingScanLog } from "../../models/packingScanLog.model.js";
import { Admin } from "../../models/admin.model.js";
import {
  determineScanStatus,
  checkAllItemsScanned,
  expandLineItems,
  calculateSkuQuantities,
  canScanComponent,
  getSkuInfo,
} from "./order.helpers.js";

// ------------------------------
// Service Exports
// ------------------------------
export async function editOrder(orderId, updates, user) {
  const order = await Order.findOne({
    _id: orderId,
    shop_domain: user.shop_domain,
  });
  if (!order) throw new Error("Order not found");

  const adminDetails = await Admin.findOne({
    admin_id: user.admin_id,
    shop_domain: user.shop_domain,
  });
  const agentName = adminDetails?.name || user.name || "Unknown Agent";

  const updateFields = {};

  if (updates.line_items) {
    const formattedLineItems = updates.line_items.map((item) => {
      if (item.component_scans) {
        return {
          sku: item.sku,
          quantity: item.quantity || 1,
          component_scans: item.component_scans,
        };
      }
      return {
        sku: item.sku,
        quantity: item.quantity || 1,
        scan: {
          scanned_qty: item.scanned_qty || 0,
          last_scanned_at: item.scanned_qty > 0 ? new Date() : null,
          scanned_by:
            item.scanned_qty > 0
              ? { admin_id: user.admin_id, name: agentName, role: user.role }
              : null,
        },
      };
    });
    updateFields.line_items = formattedLineItems;
  }

  if (updates.tracking)
    updateFields.tracking = { ...order.tracking, ...updates.tracking };
  if (updates.scan_status) {
    updateFields.scan_status = updates.scan_status;
    if (updates.scan_status === "scanned") {
      updateFields.scanned_at = new Date();
      updateFields.scanned_by = {
        agent_id: user.admin_id,
        name: agentName,
        role: user.role,
      };
    }
    if (
      updates.scan_status === "tracking_label_pending" &&
      updateFields.tracking
    ) {
      updateFields.tracking.scan_status = "pending";
    }
  }

  updateFields.last_edited_by = {
    agent_id: user.admin_id,
    name: agentName,
    role: user.role,
    edited_at: new Date(),
  };
  updateFields.updatedAt = new Date();

  const result = await Order.updateOne(
    { _id: orderId },
    { $set: updateFields },
  );
  if (result.matchedCount === 0) throw new Error("Order not found");

  // Recalculate status if not manually set
  if (!updates.scan_status) {
    const updatedOrder = await Order.findById(orderId);
    const allItemsScanned = await checkAllItemsScanned(
      updatedOrder,
      user.shop_domain,
    );
    const trackingScanned = updatedOrder.tracking?.scan_status === "scanned";
    const newStatus = determineScanStatus(allItemsScanned, trackingScanned);
    if (newStatus !== updatedOrder.scan_status) {
      await Order.updateOne(
        { _id: orderId },
        {
          $set: {
            scan_status: newStatus,
            ...(newStatus === "scanned" && {
              scanned_at: new Date(),
              scanned_by: {
                agent_id: user.admin_id,
                name: agentName,
                role: user.role,
              },
            }),
          },
        },
      );
      updateFields.scan_status = newStatus;
    }
  }

  await PackingScanLog.create({
    order_id: order._id,
    order_name: order.order_name,
    shop_domain: user.shop_domain,
    scan_type: "edit",
    action: "edit",
    scanned_by: { admin_id: user.admin_id, name: agentName, role: user.role },
    scanned_at: new Date(),
    metadata: { updated_fields: Object.keys(updateFields), updates },
  });

  return {
    success: true,
    message: "Order updated successfully",
    updated_fields: Object.keys(updateFields),
    new_status: updateFields.scan_status || null,
  };
}

export async function scanOrderBarcode(orderBarcode, user) {
  const normalizedOrder = orderBarcode.startsWith("#")
    ? orderBarcode
    : `${orderBarcode}`;

  const order = await Order.findOne({
    order_name: normalizedOrder,
    shop_domain: user.shop_domain,
  });
  if (!order) throw new Error("Order not found");

  const allItemsScanned = await checkAllItemsScanned(order, user.shop_domain);
  const trackingScanned = order.tracking?.scan_status === "scanned";
  const currentOrderStatus = determineScanStatus(
    allItemsScanned,
    trackingScanned,
  );

  if (currentOrderStatus !== order.scan_status) {
    await Order.updateOne(
      { _id: order._id },
      { $set: { scan_status: currentOrderStatus } },
    );
  }

  const adminDetails = await Admin.findOne({
    admin_id: user.admin_id,
    shop_domain: user.shop_domain,
  });
  const agentName = adminDetails?.name || user.name || "Unknown Agent";

  await Admin.updateOne(
    { admin_id: user.admin_id, shop_domain: user.shop_domain },
    {
      $set: {
        active_order: normalizedOrder,
        active_order_status: "order_loaded",
      },
    },
  );

  const expandedItems = await expandLineItems(
    order.line_items,
    user.shop_domain,
  );
  const { bundleMap } = await getSkuInfo(user.shop_domain);

  let totalItemsCount = 0,
    scannedItemsCount = 0;
  for (const item of order.line_items) {
    const bundleDoc = bundleMap.get(item.sku);
    if (bundleDoc && bundleDoc.bundle_items) {
      totalItemsCount += bundleDoc.bundle_items.length;
      for (const bundleItem of bundleDoc.bundle_items) {
        const componentScans = item.component_scans?.[bundleItem.sku] || 0;
        if (componentScans >= bundleItem.quantity * (item.quantity || 1))
          scannedItemsCount++;
      }
    } else {
      totalItemsCount++;
      if ((item.scan?.scanned_qty || 0) >= (item.quantity || 1))
        scannedItemsCount++;
    }
  }

  return {
    success: true,
    mode: "order_loaded",
    order: {
      order_name: order.order_name,
      order_scan_status: currentOrderStatus,
      tracking_scan_status: order.tracking?.scan_status || "pending",
      tracking_number: order.tracking?.number,
      carrier: order.tracking?.company,
      items: expandedItems,
      progress: {
        items_scanned: allItemsScanned,
        tracking_scanned: trackingScanned,
        order_complete: allItemsScanned && trackingScanned,
        total_items: totalItemsCount,
        scanned_items: scannedItemsCount,
      },
      status_message:
        allItemsScanned && !trackingScanned
          ? "All items scanned. Tracking label pending."
          : allItemsScanned && trackingScanned
            ? "Order complete"
            : "Items scanning in progress",
    },
    agent: {
      id: user.admin_id,
      name: agentName,
      role: user.role,
      shop_domain: user.shop_domain,
    },
  };
}

export async function scanProduct(sku, user) {
  const admin = await Admin.findOne({
    admin_id: user.admin_id,
    shop_domain: user.shop_domain,
  });
  if (!admin?.active_order)
    throw new Error("No active order. Scan order barcode first.");

  const order = await Order.findOne({
    order_name: admin.active_order,
    shop_domain: user.shop_domain,
  });
  if (!order) throw new Error("Order not found");

  const skuDoc = await Sku.findOne({
    shop_domain: user.shop_domain,
    sku: sku.trim().toUpperCase(),
    is_active: true,
  });
  if (!skuDoc) throw new Error("Invalid or inactive SKU");

  const adminDetails = await Admin.findOne({
    admin_id: user.admin_id,
    shop_domain: user.shop_domain,
  });
  const agentName = adminDetails?.name || user.name || "Unknown Agent";

  const quantities = await calculateSkuQuantities(
    order,
    skuDoc.sku,
    user.shop_domain,
  );
  if (quantities.scanned >= quantities.required) {
    throw new Error(
      `SKU ${skuDoc.sku} is fully scanned (${quantities.scanned}/${quantities.required})`,
    );
  }

  if (skuDoc.sku_type === "bundle") {
    const bundleItem = order.line_items.find((item) => item.sku === skuDoc.sku);
    if (!bundleItem) throw new Error(`Bundle ${skuDoc.sku} not found in order`);

    // Check component availability
    for (const bi of skuDoc.bundle_items) {
      const compQuantities = await calculateSkuQuantities(
        order,
        bi.sku,
        user.shop_domain,
      );
      if (compQuantities.scanned + bi.quantity > compQuantities.required) {
        throw new Error(
          "Cannot scan bundle - components would exceed required quantity",
        );
      }
    }

    // Update component scans for this bundle
    bundleItem.component_scans = bundleItem.component_scans || {};
    for (const bi of skuDoc.bundle_items) {
      const current = bundleItem.component_scans[bi.sku] || 0;
      bundleItem.component_scans[bi.sku] = current + bi.quantity;
    }
  } else {
    const availability = await canScanComponent(
      order,
      skuDoc.sku,
      user.shop_domain,
    );
    if (!availability.canScan)
      throw new Error("Could not find where to apply this scan");

    if (availability.type === "regular") {
      const item = availability.item;
      item.scan = item.scan || { scanned_qty: 0 };
      item.scan.scanned_qty += 1;
      item.scan.last_scanned_at = new Date();
      item.scan.scanned_by = {
        admin_id: user.admin_id,
        name: agentName,
        role: user.role,
      };
    } else {
      const bundleItem = availability.item;
      bundleItem.component_scans = bundleItem.component_scans || {};
      bundleItem.component_scans[availability.componentSku] =
        (bundleItem.component_scans[availability.componentSku] || 0) + 1;
    }
  }

  await PackingScanLog.create({
    order_id: order._id,
    order_name: order.order_name,
    shop_domain: user.shop_domain,
    sku: skuDoc.sku,
    scan_type: "sku",
    title: skuDoc.product_name || "",
    scanned_by: { admin_id: user.admin_id, name: agentName, role: user.role },
    scanned_at: new Date(),
    action: "scan",
    metadata: {
      total_required: quantities.required,
      total_scanned: quantities.scanned + 1,
      source_breakdown: quantities.sourceBreakdown,
    },
  });

  await Order.updateOne(
    { _id: order._id },
    {
      $set: { line_items: order.line_items, updatedAt: new Date() },
      $push: {
        scan_logs: {
          agent_id: user.admin_id,
          agent_name: agentName,
          role: user.role,
          sku: skuDoc.sku,
          scan_type: "sku",
          scanned_at: new Date(),
        },
      },
    },
  );

  const allItemsScanned = await checkAllItemsScanned(order, user.shop_domain);
  const trackingScanned = order.tracking?.scan_status === "scanned";
  const newStatus = determineScanStatus(allItemsScanned, trackingScanned);

  if (newStatus !== order.scan_status) {
    await Order.updateOne(
      { _id: order._id },
      {
        $set: {
          scan_status: newStatus,
          ...(newStatus === "scanned" && {
            scanned_at: new Date(),
            scanned_by: {
              agent_id: user.admin_id,
              name: agentName,
              role: user.role,
            },
          }),
        },
      },
    );
  }

  const adminOrderStatus =
    allItemsScanned && trackingScanned
      ? "order_completed"
      : allItemsScanned && !trackingScanned
        ? "tracking_pending"
        : "items_in_progress";
  await Admin.updateOne(
    { admin_id: user.admin_id, shop_domain: user.shop_domain },
    { $set: { active_order_status: adminOrderStatus } },
  );

  const expandedItems = await expandLineItems(
    order.line_items,
    user.shop_domain,
  );
  const newTotalScanned = quantities.scanned + 1;

  let nextActionMessage = "scan_next_sku";
  let statusMessage = `${skuDoc.product_name || skuDoc.sku} scanned (${newTotalScanned}/${quantities.required})`;
  if (allItemsScanned && !trackingScanned) {
    nextActionMessage = "scan_tracking";
    statusMessage = `✅ All items scanned! ${skuDoc.product_name || skuDoc.sku} scanned (${newTotalScanned}/${quantities.required}). Now scan tracking label.`;
  } else if (allItemsScanned && trackingScanned) {
    nextActionMessage = "order_complete";
    statusMessage = `✅ Order complete! ${skuDoc.product_name || skuDoc.sku} scanned (${newTotalScanned}/${quantities.required})`;
  }

  return {
    success: true,
    mode: "item_scanned",
    order_name: order.order_name,
    sku: skuDoc.sku,
    sku_type: skuDoc.sku_type,
    message: statusMessage,
    order_status: newStatus,
    next_action: nextActionMessage,
    progress: {
      scanned: newTotalScanned,
      required: quantities.required,
      percentage: Math.round((newTotalScanned / quantities.required) * 100),
      source_breakdown: quantities.sourceBreakdown,
    },
    agent: { id: user.admin_id, name: agentName, role: user.role },
    items: expandedItems,
  };
}

export async function scanTracking(trackingNumber, user) {
  const admin = await Admin.findOne({
    admin_id: user.admin_id,
    shop_domain: user.shop_domain,
  });
  if (!admin?.active_order)
    throw new Error("No active order. Scan order barcode first.");

  const order = await Order.findOne({
    order_name: admin.active_order,
    shop_domain: user.shop_domain,
  });
  if (!order) throw new Error("Order not found");

  if (order.tracking?.number !== trackingNumber)
    throw new Error("Tracking number doesn't match this order");
  if (order.tracking?.scan_status === "scanned")
    throw new Error("Tracking already scanned");

  const allItemsScanned = await checkAllItemsScanned(order, user.shop_domain);
  if (!allItemsScanned) {
    const expandedItems = await expandLineItems(
      order.line_items,
      user.shop_domain,
    );
    const pendingItems = expandedItems.filter((item) => item.pending_qty > 0);
    throw new Error(
      `Scan all items before tracking. Pending: ${pendingItems.map((i) => i.sku).join(", ")}`,
    );
  }

  const adminDetails = await Admin.findOne({
    admin_id: user.admin_id,
    shop_domain: user.shop_domain,
  });
  const agentName = adminDetails?.name || user.name || "Unknown Agent";

  await Order.updateOne(
    { _id: order._id },
    {
      $set: {
        "tracking.scan_status": "scanned",
        "tracking.scanned_at": new Date(),
        "tracking.scanned_by": {
          agent_id: user.admin_id,
          name: agentName,
          role: user.role,
        },
        scan_status: "scanned",
        scanned_at: new Date(),
        scanned_by: {
          agent_id: user.admin_id,
          name: agentName,
          role: user.role,
        },
      },
      $push: {
        scan_logs: {
          agent_id: user.admin_id,
          agent_name: agentName,
          role: user.role,
          tracking_number: trackingNumber,
          scan_type: "tracking",
          scanned_at: new Date(),
        },
      },
    },
  );

  await PackingScanLog.create({
    order_id: order._id,
    order_name: order.order_name,
    shop_domain: user.shop_domain,
    tracking_number: trackingNumber,
    scan_type: "tracking",
    scanned_by: { admin_id: user.admin_id, name: agentName, role: user.role },
    scanned_at: new Date(),
    action: "scan",
  });

  await Admin.updateOne(
    { admin_id: user.admin_id, shop_domain: user.shop_domain },
    { $set: { active_order: null, active_order_status: null } },
  );

  return {
    success: true,
    mode: "tracking_scanned",
    order_name: order.order_name,
    message: "✅ Order scanning completed successfully",
    agent: { id: user.admin_id, name: agentName, role: user.role },
  };
}
