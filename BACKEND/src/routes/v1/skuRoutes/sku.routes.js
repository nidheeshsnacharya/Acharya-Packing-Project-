import express from "express";
import { createSku } from "../../../controllers/skuController/sku.create.controller.js";
import { authorize, requireAuth } from "../../../middleware/auth.middleware.js";
import { deleteSku } from "../../../controllers/skuController/sku.delete.controller.js";
import { updateSku } from "../../../controllers/skuController/sku.edit.controller.js";
import { hardSkuDelete } from "../../../controllers/skuController/sku.hard.del.controller.js";
import { listSkus } from "../../../controllers/skuController/sku.getlist.controller.js";
import { bulkImportSkus } from "../../../controllers/skuController/sku.bulk.import.controller.js";
import { fileUpload } from "../../../utils/file.upload.js";

const router = express.Router();

// 🔐 Protected route
router.post("/create", requireAuth, authorize("admin", "logistics"), createSku);
router.delete(
  "/delete",
  requireAuth,
  authorize("admin", "logistics"),
  deleteSku,
);

router.put("/update", requireAuth, authorize("admin", "logistics"), updateSku);
router.delete(
  "/hard-delete",
  requireAuth,
  authorize("admin", "logistics"),
  hardSkuDelete,
);

router.get("/list", requireAuth, listSkus);

router.post(
  "/bulk-import",
  requireAuth,
  authorize("admin", "logistics"),
  fileUpload.single("file"),
  bulkImportSkus,
);
export default router;
