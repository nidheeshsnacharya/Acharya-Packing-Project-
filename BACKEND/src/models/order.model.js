import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema(
  {
    // 🔑 SHOP CONTEXT (NEW)
    shop_domain: {
      type: String,
      required: true,
      index: true,
    },

    shopify_id: {
      type: String,
      index: true,
    },

    orderId: { type: String, index: true },
    order_name: { type: String, index: true },

    email: String,
    total_price: String,
    fulfillment_status: String,

    line_items: {
      type: Array,
      default: [],
    },

    fulfillments: {
      type: Array,
      default: [],
    },

    // ⚠️ Keep as OBJECT for now (array upgrade later)
    tracking: {
      company: String,
      number: String,
      url: String,

      scan_status: {
        type: String,
        enum: ["pending", "scanned", "cancelled"],
        default: "pending",
        index: true,
      },

      scanned_by: {
        agent_id: { type: String, default: null },
        agent_name: { type: String, default: null },
        role: { type: String, default: null },
      },

      scanned_at: { type: Date, default: null },
    },

    customer: {
      first_name: String,
      last_name: String,
      email: String,
      phone: String,
      id: String,
    },

    scan_status: {
      type: String,
      enum: [
        "pending",
        "items_scanned",
        "tracking_label_pending",
        "scanned",
        "cancelled",
      ],
      default: "pending",
      index: true,
    },

    scanned_by: {
      agent_id: { type: String, default: null },
      agent_name: { type: String, default: null },
      role: { type: String, default: null },
    },

    scanned_at: { type: Date, default: null },

    scan_logs: [
      {
        agent_id: String,
        agent_name: String,
        role: String,
        sku: String,
        tracking_number: String,
        scan_type: { type: String, enum: ["sku", "tracking"] },
        scanned_at: Date,
      },
    ],

    raw_payload: mongoose.Schema.Types.Mixed,

    last_edited_by: {
      agent_id: String,
      agent_name: String,
      role: String,
      edited_at: Date,
    },
  },
  { timestamps: true },
);

/**
 * ✅ MULTI-SHOP SAFETY
 * Same order ID can exist in multiple shops
 */
OrderSchema.index({ shop_domain: 1, shopify_id: 1 }, { unique: true });

/**
 * AUTO DELETE AFTER 90 DAYS
 */
OrderSchema.index({ createdAt: 1 }, { expireAfterSeconds: 23328000 });

export const Order =
  mongoose.models.Order || mongoose.model("Order", OrderSchema);
