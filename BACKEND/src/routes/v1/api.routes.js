import express from "express";
import adminRoutes from "./adminRoutes/admin.routes.js";
import webhooksRoutes from "./webhookRoutes/webhook.routes.js";
import logisticsRoutes from "./logisticsRoutes/logistics.routes.js";
import packingRoutes from "./packingRoutes/packing.routes.js";

import authRoutes from "./authRoutes/auth.routes.js";

const router = express.Router();

router.use("/auth", authRoutes);

// 🔐 Admin Routes (Signup, Login, etc.)
router.use("/admin", adminRoutes);

// 📦 Webhook Routes (Fulfillment, etc.)
router.use("/webhooks", webhooksRoutes);

router.use("/logistics", logisticsRoutes);

router.use("/packing", packingRoutes);

export default router;
