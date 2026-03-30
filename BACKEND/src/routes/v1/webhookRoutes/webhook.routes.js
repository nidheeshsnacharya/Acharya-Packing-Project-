import express from "express";
import { handleShopifyFulfillment } from "../../../controllers/webhook/webhook.controller.js";
import { verifyShopifyWebhook } from "../../../middleware/verifyWebhook.js";

const router = express.Router();

// Apply the verification middleware ONLY to this route
router.post("/fulfillment", verifyShopifyWebhook, handleShopifyFulfillment);

export default router;
