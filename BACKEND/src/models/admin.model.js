import mongoose from "mongoose";
import bcrypt from "bcrypt";
import crypto from "crypto";

const AdminSchema = new mongoose.Schema(
  {
    admin_id: {
      type: String,
      required: true,
      unique: true,
      default: () => crypto.randomUUID(),
      index: true,
    },

    name: { type: String, required: true },

    email: {
      type: String,
      required: true,
      lowercase: true,
      index: true,

      // ❗ EMAIL MUST BE UNIQUE PER SHOP (not global)
      // We will enforce compound index below
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: ["admin", "logistics", "packing"],
      default: "admin",
      index: true,
    },

    // 🔑 SHOP OWNERSHIP (ALL USERS)
    shop_domain: {
      type: String,
      index: true,
      required: true,
    },

    // 🛍️ SHOPIFY CONFIG (ADMIN ONLY)
    shopify: {
      shop_domain: {
        type: String,
        index: true,
      },

      webhook_secret: {
        type: String,
        select: false,
      },

      api_key: { type: String, select: false },
      api_secret: { type: String, select: false },
    },

    is_active: { type: Boolean, default: true },
    must_change_password: { type: Boolean, default: false },
  },
  { timestamps: true },
);

/* 🔐 COMPOUND UNIQUE INDEX (email + shop_domain) */
AdminSchema.index({ email: 1, shop_domain: 1 }, { unique: true });

//
// HASH PASSWORD
//
AdminSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

//
// COMPARE PASSWORD
//
AdminSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

export const Admin =
  mongoose.models.Admin || mongoose.model("Admin", AdminSchema);
