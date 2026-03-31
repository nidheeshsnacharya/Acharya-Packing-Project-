import { Order } from "../../models/order.model.js";

export async function manualAddOrder(req, res) {
  try {
    const user = req.user; // from auth middleware (must include shop_domain, admin_id, role)

    // Shop safety
    if (!user.shop_domain) {
      return res.status(400).json({ error: "User is not linked to any shop" });
    }

    // Extract fields from JSON body (or from form-data if using multer)
    const {
      order_name,
      email,
      phone,
      tracking_company,
      tracking_number,
      tracking_url,
      line_items, // expected as array: [{ sku, quantity }]
    } = req.body;

    // Validation
    if (!order_name) {
      return res.status(400).json({ error: "Order number is required" });
    }

    if (!line_items || !Array.isArray(line_items) || line_items.length === 0) {
      return res
        .status(400)
        .json({ error: "At least one line item is required" });
    }

    for (const item of line_items) {
      if (!item?.sku || !item?.quantity || Number(item.quantity) <= 0) {
        return res.status(400).json({
          error: "Each line item must have SKU and positive quantity",
        });
      }
    }

    // Prevent duplicate order number (shop‑scoped)
    const exists = await Order.findOne({
      order_name,
      shop_domain: user.shop_domain,
    });
    if (exists) {
      return res.status(409).json({
        error: "Order number already exists for this shop",
      });
    }

    const now = Date.now();

    // Create the order
    const order = await Order.create({
      shop_domain: user.shop_domain,

      shopify_id: `manual_${now}`,
      orderId: `manual_${now}`,
      order_name,

      email,
      fulfillment_status: "manual",

      customer: {
        phone,
        email,
      },

      line_items: line_items.map((li) => ({
        sku: li.sku,
        quantity: Number(li.quantity),
      })),

      tracking: {
        company: tracking_company,
        number: tracking_number,
        url: tracking_url,
        scan_status: "pending",
        scanned_at: null,
        scanned_by: null,
      },

      scan_status: "pending",
      scanned_by: null,
      scanned_at: null,
      scan_logs: [],

      raw_payload: {
        source: "manual",
        created_by: {
          admin_id: user.admin_id,
          role: user.role,
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: "Manual order added successfully",
      order_id: order._id,
    });
  } catch (error) {
    console.error("Error creating manual order:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
