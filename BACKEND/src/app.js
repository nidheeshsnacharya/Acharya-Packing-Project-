import express from "express";
import cors from "cors";
import apiRoutes from "./routes/v1/api.routes.js";

const app = express();

// ==============================
// CORS CONFIGURATION (Industrial Standard)
// ==============================
// Allowed origins from environment (comma-separated)
const rawOrigins = process.env.ALLOWED_ORIGINS;
const isDev = process.env.NODE_ENV === "development";

// Build allowed origins array
let allowedOrigins = [];
if (rawOrigins) {
  allowedOrigins = rawOrigins.split(",").map((origin) => origin.trim());
} else if (isDev) {
  // In development, allow all origins for convenience
  allowedOrigins = ["*"];
} else {
  // In production without explicit origins, log a warning and restrict to same-origin
  console.warn(
    "⚠️ ALLOWED_ORIGINS not set. CORS will block all cross-origin requests.",
  );
  allowedOrigins = []; // empty array = no cross-origin allowed
}

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes("*")) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      const msg = `CORS blocked request from origin: ${origin}`;
      console.warn(msg);
      callback(new Error(msg), false);
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true, // allow cookies / authorization headers
  maxAge: 86400, // 24 hours – cache preflight requests
};

app.use(cors(corsOptions));

// ==============================
// JSON PARSER (with raw body for webhooks)
// ==============================
app.use(
  express.json({
    verify: (req, res, buf) => {
      if (req.originalUrl && req.originalUrl.includes("/webhooks")) {
        req.rawBody = buf;
      }
    },
  }),
);

// ==============================
// HEALTH CHECK
// ==============================
app.get("/", (req, res) => {
  res.send("API running");
});

// ==============================
// API ROUTES
// ==============================
app.use("/api", apiRoutes);

export default app;
