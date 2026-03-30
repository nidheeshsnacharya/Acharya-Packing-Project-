import mongoose from "mongoose";

const PackingScanLogSchema = new mongoose.Schema(
  {
    // 🏬 SHOP ISOLATION (MANDATORY)
    shop_domain: {
      type: String,
      required: true,
      index: true,
    },

    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      index: true,
    },

    order_name: {
      type: String,
      required: true,
      index: true,
    },

    sku: {
      type: String,
      default: "label",
      index: true,
    },

    tracking_number: {
      type: String,
      default: null,
    },

    scan_type: {
      type: String,
      enum: ["sku", "tracking", "edit"],
      required: true,
    },

    // Item-specific fields (for sku scans)
    title: {
      type: String,
      default: null,
    },
    previous_qty: {
      type: Number,
      default: 0,
    },
    new_qty: {
      type: Number,
      default: 0,
    },

    // Agent tracking
    scanned_by: {
      admin_id: { type: String, index: true },
      name: String,
      role: String,
    },

    scanned_at: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // Action type for categorization
    action: {
      type: String,
      enum: ["scan", "clear", "update", "cancel", "edit"],
      default: "scan",
    },

    // Additional metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

/* 🔥 PERFORMANCE INDEXES */
PackingScanLogSchema.index({ shop_domain: 1, scanned_at: -1 });
PackingScanLogSchema.index({ shop_domain: 1, "scanned_by.admin_id": 1 });
PackingScanLogSchema.index({ order_id: 1, scan_type: 1 });
PackingScanLogSchema.index({ scan_type: 1, scanned_at: -1 });

export const PackingScanLog =
  mongoose.models.PackingScanLog ||
  mongoose.model("PackingScanLog", PackingScanLogSchema);
