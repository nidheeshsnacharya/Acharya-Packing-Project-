import bcrypt from "bcrypt";
import { Admin } from "../../models/admin.model.js";
import { refreshWebhookSecrets } from "../../utils/shopifyWebhook.cache.js";

/**
 * PATCH /api/admin/edit
 * 🔐 ADMIN ONLY
 */
export const editAdminProfile = async (req, res) => {
  try {
    const user = req.user;

    /* =========================
       🔐 ADMIN ONLY GUARD
    ========================= */
    if (user.role !== "admin") {
      return res.status(403).json({
        error: "Forbidden: Admin access required",
      });
    }

    const { email, old_password, new_password, shop_domain, webhook_secret } =
      req.body;

    const update = {};
    let refreshCache = false;
    let domainUpdated = false;

    /* =========================
       🔍 FETCH ADMIN ONCE (OPTIMIZED)
    ========================= */
    const currentAdmin = await Admin.findOne({
      admin_id: user.admin_id,
      is_active: true,
    }).select("+password");

    if (!currentAdmin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    /* =========================
       📧 EMAIL UPDATE
    ========================= */
    if (email) {
      const formattedEmail = email.toLowerCase().trim();

      if (formattedEmail !== currentAdmin.email?.toLowerCase()) {
        const existingEmail = await Admin.findOne({
          email: formattedEmail,
          admin_id: { $ne: user.admin_id },
          is_active: true,
        });

        if (existingEmail) {
          return res.status(400).json({
            error:
              "This email address is already connected to another account.",
          });
        }

        update.email = formattedEmail;
      }
    }

    /* =========================
       🔑 PASSWORD UPDATE
    ========================= */
    if (new_password) {
      if (!old_password) {
        return res.status(400).json({
          error: "Old password is required",
        });
      }

      const valid = await bcrypt.compare(old_password, currentAdmin.password);

      if (!valid) {
        return res.status(401).json({
          error: "Old password is incorrect",
        });
      }

      const hashedPassword = await bcrypt.hash(new_password, 10);

      update.password = hashedPassword;
      update.must_change_password = false;
    }

    /* =========================
       🏬 SHOP DOMAIN UPDATE (CASCADE FIX)
    ========================= */
    if (shop_domain) {
      const formattedDomain = shop_domain
        .trim()
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "")
        .toLowerCase();

      const currentDomain =
        currentAdmin?.shopify?.shop_domain || currentAdmin?.shop_domain;

      if (formattedDomain !== currentDomain) {
        const domainExists = await Admin.findOne({
          $or: [
            { "shopify.shop_domain": formattedDomain },
            { shop_domain: formattedDomain },
          ],
          admin_id: { $ne: user.admin_id },
          is_active: true,
        });

        if (domainExists) {
          return res.status(400).json({
            error: "This shop domain is already linked to another account.",
          });
        }

        // 🔄 CASCADE UPDATE
        await Admin.updateMany(
          {
            shop_domain: currentDomain,
            is_active: true,
          },
          {
            $set: {
              shop_domain: formattedDomain,
              "shopify.shop_domain": formattedDomain,
            },
          },
        );

        domainUpdated = true;
        refreshCache = true;
      }
    }

    /* =========================
       🔐 WEBHOOK SECRET UPDATE
    ========================= */
    if (webhook_secret) {
      update["shopify.webhook_secret"] = webhook_secret;
      refreshCache = true;
    }

    /* =========================
       ❌ NOTHING TO UPDATE
    ========================= */
    if (!Object.keys(update).length && !domainUpdated) {
      return res.status(200).json({
        success: true,
        message: "No changes detected",
        updated_fields: [],
        webhook_cache_refreshed: false,
      });
    }

    /* =========================
       💾 UPDATE ADMIN (NON-DOMAIN FIELDS)
    ========================= */
    if (Object.keys(update).length) {
      const result = await Admin.updateOne(
        { admin_id: user.admin_id },
        { $set: update },
      );

      if (!result.matchedCount) {
        return res.status(404).json({ error: "Admin not found" });
      }
    }

    /* =========================
       🔄 REFRESH WEBHOOK CACHE
    ========================= */
    if (refreshCache) {
      await refreshWebhookSecrets();
    }

    /* =========================
       ✅ FINAL RESPONSE (FIXED)
    ========================= */
    return res.status(200).json({
      success: true,
      updated_fields: [
        ...Object.keys(update),
        ...(domainUpdated ? ["shop_domain"] : []),
      ],
      webhook_cache_refreshed: refreshCache,
    });
  } catch (error) {
    console.error("Edit Admin Error:", error);

    return res.status(500).json({
      error: "Internal Server Error",
    });
  }
};
