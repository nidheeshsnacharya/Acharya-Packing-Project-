import mongoose from "mongoose";

const BundleItemSchema = new mongoose.Schema(
  {
    sku: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: false },
);

const SkuSchema = new mongoose.Schema(
  {
    shop_domain: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    product_name: {
      type: String,
      required: true,
      trim: true,
    },

    image_url: {
      type: String,
      default: null,
    },

    // ✅ NEW
    sku_type: {
      type: String,
      enum: ["simple", "bundle"],
      default: "simple",
    },

    // ✅ Only for bundle
    bundle_items: {
      type: [BundleItemSchema],
      default: [],
    },

    created_by: {
      admin_id: String,
      role: String,
    },

    is_active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

// Multi-tenant unique
SkuSchema.index({ shop_domain: 1, sku: 1 }, { unique: true });

export const Sku = mongoose.models.Sku || mongoose.model("Sku", SkuSchema);
