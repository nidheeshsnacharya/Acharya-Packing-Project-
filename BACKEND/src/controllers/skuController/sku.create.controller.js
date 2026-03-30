import { Sku } from "../../models/sku.model.js";

/**
 * 📦 Create SKU
 * Route: POST /api/sku/create
 * 🔐 Admin & Logistics only
 * 🔄 Supports simple & bundle SKUs with auto-creation of missing components
 */
export const createSku = async (req, res) => {
  try {
    const user = req.user;

    /* =========================
       🔐 ROLE & SHOP CHECK
    ========================= */
    if (!["admin", "logistics"].includes(user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const shopDomain = user.shop_domain?.trim().toLowerCase();
    if (!shopDomain) {
      return res.status(400).json({ error: "User is not linked to any shop" });
    }

    const {
      sku,
      product_name,
      image_url,
      sku_type = "simple",
      bundle_items = [],
    } = req.body;

    if (!sku || !product_name) {
      return res
        .status(400)
        .json({ error: "SKU and product_name are required" });
    }

    /* =========================
       🔄 NORMALIZATION
    ========================= */
    const normalizedSku = sku.trim().toUpperCase();
    const normalizedProductName = product_name.trim();
    const normalizedType = sku_type === "bundle" ? "bundle" : "simple";

    let finalBundleItems = [];
    const autoCreatedSkus = []; // Track auto-created or reactivated SKUs

    /* =========================
       📦 BUNDLE VALIDATION & AUTO-CREATION
    ========================= */
    if (normalizedType === "bundle") {
      if (!Array.isArray(bundle_items) || bundle_items.length === 0) {
        return res
          .status(400)
          .json({ error: "Bundle must contain at least one item" });
      }

      for (const item of bundle_items) {
        if (!item.sku || !item.quantity) {
          return res.status(400).json({ error: "Invalid bundle item format" });
        }

        const childSkuCode = item.sku.trim().toUpperCase();

        // ❌ Prevent self-reference
        if (childSkuCode === normalizedSku) {
          return res
            .status(400)
            .json({ error: "Bundle cannot contain itself" });
        }

        // 🔍 Check if child SKU exists
        let child = await Sku.findOne({
          shop_domain: shopDomain,
          sku: childSkuCode,
        });

        // 🆕 AUTO-CREATE MISSING SKU
        if (!child) {
          const childProductName =
            item.product_name || `Auto-created for ${normalizedSku}`;
          const childImageUrl = item.image_url || null;

          try {
            await Sku.create({
              shop_domain: shopDomain,
              sku: childSkuCode,
              product_name: childProductName,
              image_url: childImageUrl,
              sku_type: "simple",
              bundle_items: [],
              is_active: true,
              created_by: {
                admin_id: user.admin_id,
                role: user.role,
              },
              created_at: new Date(),
              metadata: {
                auto_created_for_bundle: normalizedSku,
                auto_created_at: new Date().toISOString(),
              },
            });

            // Re-fetch to ensure availability
            child = await Sku.findOne({
              shop_domain: shopDomain,
              sku: childSkuCode,
            });

            autoCreatedSkus.push({
              sku: childSkuCode,
              product_name: childProductName,
              image_url: childImageUrl,
              action: "created",
            });
          } catch (err) {
            if (err?.code === 11000) {
              // Handle race condition
              child = await Sku.findOne({
                shop_domain: shopDomain,
                sku: childSkuCode,
              });
              if (!child) {
                return res
                  .status(500)
                  .json({ error: `Failed to create SKU ${childSkuCode}` });
              }
            } else {
              throw err;
            }
          }
        } else if (!child.is_active) {
          // 🔄 Reactivate inactive SKU
          child.is_active = true;
          child.updated_by = {
            admin_id: user.admin_id,
            role: user.role,
            updated_at: new Date(),
            action: "reactivated_for_bundle",
          };
          await child.save();

          autoCreatedSkus.push({
            sku: childSkuCode,
            product_name: child.product_name,
            image_url: child.image_url,
            action: "reactivated",
          });
        }

        // ❌ Check for nested bundles (not allowed)
        if (child.sku_type === "bundle") {
          return res
            .status(400)
            .json({ error: "Nested bundles are not allowed" });
        }

        finalBundleItems.push({
          sku: childSkuCode,
          quantity: Number(item.quantity),
        });
      }
    }

    /* =========================
       💾 SAVE FINAL SKU
    ========================= */
    try {
      await Sku.create({
        shop_domain: shopDomain,
        sku: normalizedSku,
        product_name: normalizedProductName,
        image_url: image_url || null,
        sku_type: normalizedType,
        bundle_items: normalizedType === "bundle" ? finalBundleItems : [],
        created_by: {
          admin_id: user.admin_id,
          role: user.role,
        },
        created_at: new Date(),
        metadata:
          normalizedType === "bundle" && autoCreatedSkus.length > 0
            ? {
                auto_created_components: autoCreatedSkus,
              }
            : undefined,
      });
    } catch (err) {
      // 🔐 DB-level duplicate guard (per shop)
      if (err?.code === 11000) {
        return res
          .status(409)
          .json({ error: "SKU already exists for this shop" });
      }
      throw err;
    }

    /* =========================
       ✅ FINAL RESPONSE
    ========================= */
    const response = {
      success: true,
      message:
        normalizedType === "bundle"
          ? autoCreatedSkus.length > 0
            ? `Bundle created successfully with ${autoCreatedSkus.length} auto-created component(s)`
            : "Bundle created successfully"
          : "SKU created successfully",
      shop_domain: shopDomain,
      sku: normalizedSku,
      sku_type: normalizedType,
    };

    if (autoCreatedSkus.length > 0) {
      response.auto_created_skus = autoCreatedSkus;
    }

    return res.status(201).json(response);
  } catch (error) {
    console.error("Create SKU Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
