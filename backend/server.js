import "dotenv/config";
import { env } from "./config/validateEnv.js";

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";

import authRoutes from "./routes/auth.js";
import igdbRoutes from "./routes/igdb.js";
import libraryRoutes from "./routes/library.js";
import userRoutes from "./routes/users.js";
import profileCommentRoutes from "./routes/profileComments.js";
import friendsRoutes from "./routes/friends.js";
import { authLimiter, apiLimiter } from "./middleware/rateLimiter.js";

const app = express();

app.set("etag", false);
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

const allowedOrigins = [
  env.FRONTEND_ORIGIN,
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:5173",
  "http://127.0.0.1:5173"
].filter(Boolean);

// Disable caching for API routes
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// CORS configuration
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true
}));

app.use(cookieParser());
app.use(express.json());

// Apply rate limiters
app.use("/api/login", authLimiter);
app.use("/api/register", authLimiter);
app.use("/api/auth", authLimiter);
app.use("/api", apiLimiter);

// Connect to MongoDB
mongoose.connect(env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected");
    console.log("readyState:", mongoose.connection.readyState);
    console.log("DB:", mongoose.connection.db?.databaseName);
    console.log("Host:", mongoose.connection.host);
  })
  .catch((err) => console.log("MongoDB Error:", err));

app.get("/ping", (req, res) => {
  console.log("PING ROUTE HIT");
  res.send("SERVER PING OK");
});

// API routes
app.use("/api", authRoutes);
app.use("/api/igdb", igdbRoutes);
app.use("/api/library", libraryRoutes);
app.use("/api/users", userRoutes);
app.use("/api/profile-comments", profileCommentRoutes);
app.use("/api/friends", friendsRoutes);

app.use((err, req, res, next) => {
  console.error("Global error handler caught:", {
    method: req.method,
    path: req.originalUrl,
    message: err?.message,
    stack: env.NODE_ENV === "production" ? undefined : err?.stack
  });

  if (res.headersSent) {
    return next(err);
  }

  if (err?.message === "Not allowed by CORS") {
    return res.status(403).json({ message: "CORS blocked this request" });
  }

  return res.status(err?.status || 500).json({
    message:
      env.NODE_ENV === "production"
        ? "Internal server error"
        : (err?.message || "Internal server error")
  });
});

const PORT = env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server runs on http://localhost:${PORT}`);
});