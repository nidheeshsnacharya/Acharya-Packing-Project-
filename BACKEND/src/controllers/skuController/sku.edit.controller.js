import { Sku } from "../../models/sku.model.js";

/**
 * ✏️ Update SKU Controller
 * Route: PUT /api/sku/update
 * Roles: admin, logistics
 * Shop-scoped updates, supports:
 * - Rename SKU
 * - Edit fields (product_name, image_url, is_active)
 * - Change type: simple or bundle
 * - Auto-create missing SKUs inside bundles
 */
export const updateSku = async (req, res) => {
  try {
    const user = req.user;

    /* =========================
       🔐 ROLE CHECK
    ========================= */
    if (!["admin", "logistics"].includes(user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    /* =========================
       🏬 SHOP CONTEXT
    ========================= */
    const shopDomain = user.shop_domain?.trim().toLowerCase();
    if (!shopDomain) {
      return res.status(400).json({ error: "User is not linked to any shop" });
    }

    const {
      sku, // existing SKU (required)
      new_sku, // optional rename
      product_name,
      image_url,
      is_active,
      sku_type,
      bundle_items,
    } = req.body;

    if (!sku) {
      return res.status(400).json({ error: "SKU is required" });
    }

    const normalizedSku = sku.trim().toUpperCase();

    /* =========================
       🔍 FIND SKU (SHOP-SCOPED)
    ========================= */
    const skuDoc = await Sku.findOne({
      shop_domain: shopDomain,
      sku: normalizedSku,
    });

    if (!skuDoc) {
      return res.status(404).json({ error: "SKU not found for this shop" });
    }

    /* =========================
       🔁 SKU RENAME
    ========================= */
    if (new_sku && new_sku.trim().toUpperCase() !== skuDoc.sku) {
      const normalizedNewSku = new_sku.trim().toUpperCase();

      const exists = await Sku.findOne({
        shop_domain: shopDomain,
        sku: normalizedNewSku,
      });

      if (exists) {
        return res
          .status(409)
          .json({ error: "New SKU already exists for this shop" });
      }

      skuDoc.sku = normalizedNewSku;
    }

    /* =========================
       ✏️ UPDATE OTHER FIELDS
    ========================= */
    if (product_name !== undefined) skuDoc.product_name = product_name.trim();
    if (image_url !== undefined) skuDoc.image_url = image_url || null;
    if (typeof is_active === "boolean") skuDoc.is_active = is_active;

    /* =========================
       📦 BUNDLE / SKU TYPE LOGIC
    ========================= */
    if (sku_type !== undefined) {
      const normalizedType = sku_type === "bundle" ? "bundle" : "simple";

      if (normalizedType === "bundle") {
        if (!Array.isArray(bundle_items) || bundle_items.length === 0) {
          return res
            .status(400)
            .json({ error: "Bundle must contain at least one item" });
        }

        const validatedItems = [];
        const createdSkus = []; // Track newly created/reactivated SKUs

        for (const item of bundle_items) {
          if (!item.sku || !item.quantity) {
            return res
              .status(400)
              .json({ error: "Invalid bundle item format" });
          }

          const childSkuCode = item.sku.trim().toUpperCase();

          // ❌ Prevent self-reference
          if (childSkuCode === skuDoc.sku) {
            return res
              .status(400)
              .json({ error: "Bundle cannot contain itself" });
          }

          // 🔍 Check for existing active SKU
          let child = await Sku.findOne({
            shop_domain: shopDomain,
            sku: childSkuCode,
            is_active: true,
          });

          // 🆕 AUTO-CREATE OR REACTIVATE
          if (!child) {
            const inactiveChild = await Sku.findOne({
              shop_domain: shopDomain,
              sku: childSkuCode,
            });

            if (inactiveChild) {
              // Reactivate the inactive SKU
              inactiveChild.is_active = true;
              inactiveChild.updated_by = {
                admin_id: user.admin_id,
                role: user.role,
                updated_at: new Date(),
                action: "reactivated_for_bundle",
              };
              await inactiveChild.save();
              child = inactiveChild;

              createdSkus.push({
                sku: childSkuCode,
                action: "reactivated",
                message: "Inactive SKU reactivated for bundle",
              });
            } else {
              // Create new simple SKU
              try {
                await Sku.create({
                  shop_domain: shopDomain,
                  sku: childSkuCode,
                  product_name: `Auto-created for bundle: ${skuDoc.sku}`,
                  image_url: null,
                  sku_type: "simple",
                  bundle_items: [],
                  created_by: {
                    admin_id: user.admin_id,
                    role: user.role,
                  },
                  is_active: true,
                });

                child = await Sku.findOne({
                  shop_domain: shopDomain,
                  sku: childSkuCode,
                });

                createdSkus.push({
                  sku: childSkuCode,
                  action: "created",
                  message: "New SKU automatically created for bundle",
                });
              } catch (err) {
                if (err?.code === 11000) {
                  // Race condition handling
                  child = await Sku.findOne({
                    shop_domain: shopDomain,
                    sku: childSkuCode,
                  });
                  if (!child)
                    return res
                      .status(500)
                      .json({ error: `Failed to resolve SKU ${childSkuCode}` });
                } else {
                  throw err;
                }
              }
            }
          }

          // ❌ No nested bundles
          if (child.sku_type === "bundle") {
            return res
              .status(400)
              .json({ error: "Nested bundles are not allowed" });
          }

          validatedItems.push({
            sku: childSkuCode,
            quantity: Number(item.quantity),
          });
        }

        skuDoc.sku_type = "bundle";
        skuDoc.bundle_items = validatedItems;

        // Add audit log for auto-created items if they exist
        if (createdSkus.length > 0) {
          skuDoc.bundle_auto_created = createdSkus;
        }
      } else {
        // If converting back to simple
        skuDoc.sku_type = "simple";
        skuDoc.bundle_items = [];
        skuDoc.bundle_auto_created = undefined;
      }
    }

    /* =========================
       🧾 AUDIT INFO & SAVE
    ========================= */
    skuDoc.updated_by = {
      admin_id: user.admin_id,
      role: user.role,
      updated_at: new Date(),
    };

    await skuDoc.save();

    /* =========================
       ✅ RESPONSE
    ========================= */
    const responseMessage = {
      success: true,
      message: "SKU updated successfully",
      shop_domain: shopDomain,
      sku: skuDoc.sku,
      sku_type: skuDoc.sku_type,
    };

    if (skuDoc.bundle_auto_created) {
      responseMessage.auto_created_skus = skuDoc.bundle_auto_created;
      responseMessage.message += ` with ${skuDoc.bundle_auto_created.length} auto-created SKU(s)`;
    }

    return res.status(200).json(responseMessage);
  } catch (error) {
    console.error("Update SKU Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
