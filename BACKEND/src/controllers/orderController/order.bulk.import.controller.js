import fs from "fs";
import path from "path";
import csv from "csv-parser";
import ExcelJS from "exceljs"; // ✅ safer replacement
import { Order } from "../../models/order.model.js";

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

/* ==============================
   🚀 EXPRESS CONTROLLER
============================== */
export const bulkImportOrders = async (req, res) => {
  const user = req.user;
  const file = req.file;

  if (!file) return res.status(400).json({ error: "File is required" });
  if (!user.shop_domain)
    return res.status(400).json({ error: "User is not linked to any shop" });

  const filePath = file.path;
  let rows = [];
  const errors = [];
  const createdOrders = new Set();

  try {
    const ext = path.extname(file.originalname).toLowerCase();

    /* ==============================
       1. READ FILE CONTENT
    ============================== */
    if (ext === ".xls" || ext === ".xlsx") {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      const worksheet = workbook.worksheets[0]; // first sheet

      // Read Excel rows as objects (header-based)
      const headerRow = worksheet.getRow(1);
      const headers = headerRow.values.slice(1); // ExcelJS index starts at 1
      rows = [];

      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return; // skip header
        const rowData = {};
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const header = headers[colNumber - 1];
          rowData[header] = cell.value;
        });
        rows.push(rowData);
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

    /* ==============================
       2. GROUP BY ORDER NAME
    ============================== */
    const grouped = {};
    for (const row of rows) {
      const order_name = pick(row, [
        "order-id",
        "order id",
        "invoice_no",
        "invoice no",
        "order_name",
        "ordernumber",
      ]);
      const sku = pick(row, ["sku", "merchant-sku", "vendor_order_item_sku"]);
      const quantity = pick(row, [
        "quantity",
        "quantity-purchased",
        "vendor_order_item_quantity",
      ]);

      if (!order_name || !sku || !quantity) {
        errors.push({ error: "Missing order_name / sku / quantity", row });
        continue;
      }

      grouped[order_name] ??= { items: [], metaRows: [] };
      grouped[order_name].items.push({
        sku: String(sku).trim(),
        quantity: Number(quantity),
      });
      grouped[order_name].metaRows.push(row);
    }

    /* ==============================
       3. DATABASE INSERTION
    ============================== */
    for (const order_name of Object.keys(grouped)) {
      const group = grouped[order_name];

      const exists = await Order.findOne({
        order_name,
        shop_domain: user.shop_domain,
      });

      if (exists) {
        errors.push({
          order_name,
          error: "Order already exists for this shop",
        });
        continue;
      }

      let email = "";
      let name = "";
      let phone = "";
      let tracking_company = "";
      let tracking_number = "";
      let tracking_url = "";

      for (const r of group.metaRows) {
        email ||= pick(r, [
          "email",
          "buyer-email",
          "customer email",
          "customer_shipping_email",
        ]);
        name ||= pick(r, [
          "name",
          "customer name",
          "buyer-name",
          "customer_shipping_name",
          "customer_shipping_firstname",
        ]);
        phone ||= pick(r, [
          "phone",
          "buyer-phone-number",
          "customer phone",
          "customer_shipping_mobile",
        ]);
        tracking_company ||= pick(r, [
          "carrier",
          "tracking_company",
          "service",
        ]);
        tracking_number ||= pick(r, [
          "tracking-number",
          "tracking_number",
          "tracking-id",
        ]);
        tracking_url ||= pick(r, ["tracking_url"]);
      }

      const now = Date.now();

      await Order.create({
        shop_domain: user.shop_domain,
        shopify_id: `bulk_${now}_${order_name}`,
        orderId: `bulk_${now}_${order_name}`,
        order_name,
        email,
        fulfillment_status: "manual",
        customer: { phone, email, name },
        line_items: group.items,
        tracking: {
          company: tracking_company,
          number: tracking_number,
          url: tracking_url,
        },
        scan_status: "pending",
        scanned_by: null,
        scanned_at: null,
        scan_logs: [],
        raw_payload: {
          source: "bulk_import",
          file_name: file.originalname,
          rows: group.metaRows,
          created_by: { admin_id: user.admin_id, role: user.role },
        },
      });

      createdOrders.add(order_name);
    }

    return res.status(200).json({
      success: true,
      shop_domain: user.shop_domain,
      total_rows: rows.length,
      created_count: createdOrders.size,
      failed_count: errors.length,
      errors,
    });
  } catch (err) {
    console.error("Bulk Import Error:", err);
    return res.status(500).json({ error: err.message || "Bulk import failed" });
  } finally {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
};
