import express from "express";
import { createPackingUser } from "../../../controllers/packingController/packing.create.controller.js";
import { authorize, requireAuth } from "../../../middleware/auth.middleware.js";
import { deletePackingUser } from "../../../controllers/packingController/packing.delete.controller.js";

const router = express.Router();

// 🔐 Protected route
router.post(
  "/create",
  requireAuth,
  authorize("admin", "logistics"),
  createPackingUser,
);
router.delete(
  "/delete",
  requireAuth,
  authorize("admin", "logistics"),
  deletePackingUser,
);
export default router;
