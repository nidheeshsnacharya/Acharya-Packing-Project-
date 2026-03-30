import express from "express";
import apiRoutes from "./routes/v1/api.routes.js";

const app = express();

/**
 * 🛠️ CRITICAL: Single JSON Parser with Raw Body Support
 * We move this to the top and add the 'verify' function.
 */
app.use(
  express.json({
    verify: (req, res, buf) => {
      // This captures the raw buffer needed for HMAC verification
      if (req.originalUrl && req.originalUrl.includes("/webhooks")) {
        req.rawBody = buf;
      }
    },
  }),
);

app.get("/", (req, res) => {
  res.send("API running");
});

app.use("/api", apiRoutes);

export default app;
