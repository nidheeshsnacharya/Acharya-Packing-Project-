import express from "express";
import { createPackingUser } from "../../../controllers/packingController/packing.create.controller.js";
import { authorize, requireAuth } from "../../../middleware/auth.middleware.js";
import { deletePackingUser } from "../../../controllers/packingController/packing.delete.controller.js";
import { getPackingAgentStats } from "../../../controllers/packingController/packing.agent.status.controller.js";
import { getPackingStatsSimple } from "../../../controllers/packingController/packing.my-status.controller.js";
import { getPackingLeaderboard } from "../../../controllers/packingController/packing.stats.controller.js";

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

router.get(
  "/agent/status",
  requireAuth,
  authorize("packing"),
  getPackingAgentStats,
);

router.get(
  "/my-status",
  requireAuth,
  authorize("packing"),
  getPackingStatsSimple,
);

router.get(
  "/stats",
  requireAuth,
  authorize("admin", "logistics"),
  getPackingLeaderboard,
);

export default router;
