import dotenv from "dotenv";
// Load env vars at the VERY top
dotenv.config();

import app from "./src/app.js";
import connectDB from "./src/config/db.js";
import { loadWebhookSecrets } from "./src/utils/shopifyWebhook.cache.js";

const startServer = async () => {
  try {
    // 1. Connect DB (Only once)
    await connectDB();
    console.log("📦 Database connected");

    // 2. Load Webhook Secrets into memory for the middleware to use
    await loadWebhookSecrets();

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Startup Error:", error);
    process.exit(1);
  }
};

startServer();
