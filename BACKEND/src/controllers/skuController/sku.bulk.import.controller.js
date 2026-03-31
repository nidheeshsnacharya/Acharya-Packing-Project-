import fs from "fs";
import path from "path";
import csv from "csv-parser";
import ExcelJS from "exceljs"; // ✅ safer replacement
import { Sku } from "../../models/sku.model.js";

/* ==============================
   HELPERS
============================== */
const normalizeKey = (key = "") =>
  key
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const pick = (row, keys = []) => {
  const map = {};
  for (const k in row) {
    map[normalizeKey(k)] = row[k];
  }
  for (const key of keys) {
    const val = map[normalizeKey(key)];
    if (val !== undefined && val !== null && val !== "") {
      return val;
    }
  }
  return "";
};

const parseBundleItems = (value = "") => {
  if (!value) return [];
  return String(value)
    .split("|")
    .map((item) => {
      const [sku, qty] = item.split(":");
      return {
        sku: sku?.trim()?.toUpperCase(),
        quantity: Number(qty) || 1,
      };
    })
    .filter((i) => i.sku && i.quantity > 0);
};

/* ==============================
   🚀 EXPRESS CONTROLLER
============================== */
export const bulkImportSkus = async (req, res) => {
  const user = req.user;
  const file = req.file; // From Multer

  if (!file) return res.status(400).json({ error: "File is required" });
  if (!user.shop_domain)
    return res.status(400).json({ error: "User is not linked to any shop" });

  const filePath = file.path;
  let rows = [];
  const errors = [];
  let created = 0;
  let skipped = 0;

  try {
    const ext = path.extname(file.originalname).toLowerCase();

    /* 📖 READ FILE */
    if (ext === ".xls" || ext === ".xlsx") {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      const worksheet = workbook.worksheets[0]; // first sheet

      rows = [];
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        const rowData = {};
        row.eachCell((cell, colNumber) => {
          const header = worksheet.getRow(1).getCell(colNumber).value;
          rowData[header] = cell.value;
        });
        if (rowNumber !== 1) rows.push(rowData); // skip header row
      });
    } else if (ext === ".csv") {
      rows = await new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
          .pipe(csv())
          .on("data", (row) => results.push(row))
          .on("end", () => resolve(results))
          .on("error", (err) => reject(err));
      });
    } else {
      return res.status(400).json({ error: "Unsupported file type" });
    }

    if (!rows.length) return res.status(400).json({ error: "No rows found" });

    /* ⚙️ PROCESS ROWS */
    for (const row of rows) {
      try {
        const sku = pick(row, [
          "sku",
          "merchant-sku",
          "item_sku",
          "vendor_sku",
          "product-sku",
          "variant sku",
        ]);
        const product_name = pick(row, [
          "product_name",
          "product",
          "title",
          "item-name",
          "product title",
        ]);
        const image_url = pick(row, [
          "image_url",
          "image",
          "image-url",
          "thumbnail",
          "product_image",
          "image src",
        ]);
        const sku_type_raw = pick(row, ["sku_type", "type"]);
        const bundle_items_raw = pick(row, [
          "bundle_items",
          "bundle",
          "components",
        ]);

        if (!sku || !product_name) {
          skipped++;
          continue;
        }

        const normalizedSku = String(sku).trim().toUpperCase();
        const sku_type =
          String(sku_type_raw || "simple").toLowerCase() === "bundle"
            ? "bundle"
            : "simple";

        const exists = await Sku.findOne({
          shop_domain: user.shop_domain,
          sku: normalizedSku,
        });
        if (exists) {
          skipped++;
          continue;
        }

        let bundle_items = [];
        if (sku_type === "bundle") {
          bundle_items = parseBundleItems(bundle_items_raw);

          if (!bundle_items.length) {
            skipped++;
            errors.push({
              error: "Bundle SKU without valid bundle_items",
              row,
            });
            continue;
          }

          let validBundle = true;
          for (const item of bundle_items) {
            const child = await Sku.findOne({
              shop_domain: user.shop_domain,
              sku: item.sku,
            });
            if (!child) {
              validBundle = false;
              skipped++;
              errors.push({ error: `Child SKU ${item.sku} not found`, row });
              break;
            }
            if (child.sku_type === "bundle") {
              validBundle = false;
              skipped++;
              errors.push({ error: "Nested bundles not allowed", row });
              break;
            }
          }
          if (!validBundle) continue;
        }

        await Sku.create({
          shop_domain: user.shop_domain,
          sku: normalizedSku,
          product_name: String(product_name).trim(),
          image_url: image_url ? String(image_url).trim() : null,
          sku_type,
          bundle_items: sku_type === "bundle" ? bundle_items : [],
          is_active: true,
          created_by: { admin_id: user.admin_id, role: user.role },
          raw_payload: {
            source: "bulk_import",
            file_name: file.originalname,
            row,
          },
          created_at: new Date(),
        });

        created++;
      } catch (err) {
        errors.push({ error: err.message, row });
      }
    }

    return res
      .status(200)
      .json({
        success: true,
        shop_domain: user.shop_domain,
        total_rows: rows.length,
        created,
        skipped,
        failed: errors.length,
        errors,
      });
  } catch (err) {
    return res
      .status(500)
      .json({ error: err.message || "Bulk SKU import failed" });
  } finally {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
};
