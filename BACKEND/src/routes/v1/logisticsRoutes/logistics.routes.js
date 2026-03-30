import express from "express";
import { createLogisticsUser } from "../../../controllers/logisticsController/logistics.create.controller.js";
import { authorize, requireAuth } from "../../../middleware/auth.middleware.js";
import { deleteLogisticsUser } from "../../../controllers/logisticsController/logistics.delete.controller.js";

const router = express.Router();

// 🔐 Protected route
router.post("/create", requireAuth, authorize("admin"), createLogisticsUser);
router.delete("/delete", requireAuth, authorize("admin"), deleteLogisticsUser);

export default router;
