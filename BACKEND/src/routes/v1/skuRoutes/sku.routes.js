import express from "express";
import { createSku } from "../../../controllers/skuController/sku.create.controller.js";
import { authorize, requireAuth } from "../../../middleware/auth.middleware.js";
import { deleteSku } from "../../../controllers/skuController/sku.delete.controller.js";
import { updateSku } from "../../../controllers/skuController/sku.edit.controller.js";
import { hardSkuDelete } from "../../../controllers/skuController/sku.hard.del.controller.js";

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

export default router;
