import express from "express";
import { authorize, requireAuth } from "../../../middleware/auth.middleware.js";
import { getAllOrders } from "../../../controllers/orderController/order.getall.controller.js";
import { bulkImportOrders } from "../../../controllers/orderController/order.bulk.import.controller.js";
import { fileUpload } from "../../../utils/file.upload.js";
import { handleAction } from "../../../controllers/orderController/order.edit.controller.js";
import { deleteOrders } from "../../../controllers/orderController/order.hard.del.controller.js";
import { manualAddOrder } from "../../../controllers/orderController/order.manual.controller.js";
import { getPendingScanSummary } from "../../../controllers/orderController/order.pending-scan-summary.js";
import { getScanDetails } from "../../../controllers/orderController/order.scan.details.controller.js";
import { scanSku } from "../../../controllers/orderController/order.scan.controller.js";
import { getOrderStats } from "../../../controllers/orderController/order.status.all.controller.js";
import { getTodayStats } from "../../../controllers/orderController/order.stats.today.controller.js";
import { getYesterdayStats } from "../../../controllers/orderController/order.stats.yesterday.js";
import { getCancelledOrders } from "../../../controllers/orderController/order.cancelled.controller.js";
import { getPendingOrders } from "../../../controllers/orderController/order.pending.controller.js";
import { getScannedOrders } from "../../../controllers/orderController/order.scanned.controller.js";
import { getOrderDailyScanStats } from "../../../controllers/orderController/order.scan.daily.stats.controller.js";
const router = express.Router();

// 🔐 Protected route
router.get("/all", requireAuth, authorize("admin", "logistics"), getAllOrders);
router.post(
  "/bulk-import",
  requireAuth,
  authorize("admin", "logistics"),
  fileUpload.single("file"),
  bulkImportOrders,
);

router.post(
  "/edit",
  requireAuth,
  authorize("admin", "logistics", "packing"),
  handleAction,
);

router.delete(
  "/delete",
  requireAuth,
  authorize("admin", "logistics"),
  deleteOrders,
);

router.post(
  "/add",
  requireAuth,
  authorize("admin", "logistics"),
  manualAddOrder,
);

router.get(
  "/pending-scan-summary",
  requireAuth,
  authorize("admin", "logistics"),
  getPendingScanSummary,
);

router.get(
  "/scan-details",
  requireAuth,
  authorize("admin", "logistics", "packing"),
  getScanDetails,
);

router.post(
  "/scan",
  requireAuth,
  authorize("admin", "logistics", "packing"),
  scanSku,
);
router.get(
  "/stats/all",
  requireAuth,
  authorize("admin", "logistics"),
  getOrderStats,
);

router.get(
  "/stats/today",
  requireAuth,
  authorize("admin", "logistics"),
  getTodayStats,
);

router.get(
  "/stats/yesterday",
  requireAuth,
  authorize("admin", "logistics"),
  getYesterdayStats,
);

router.get(
  "/cancelled",
  requireAuth,
  authorize("admin", "logistics"),
  getCancelledOrders,
);

router.get(
  "/pending",
  requireAuth,
  authorize("admin", "logistics"),
  getPendingOrders,
);

router.get(
  "/scanned",
  requireAuth,
  authorize("admin", "logistics"),
  getScannedOrders,
);

router.get(
  "/scan-daily",
  requireAuth,
  authorize("admin", "logistics"),
  getOrderDailyScanStats,
);

export default router;
