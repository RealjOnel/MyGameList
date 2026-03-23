import dotenv from "dotenv";
dotenv.config();

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";

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

const allowedOrigins = [
  process.env.FRONTEND_ORIGIN,
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:5173",
  "http://127.0.0.1:5173"
].filter(Boolean);

// no caching for API
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

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

// Rate Limits
app.use("/api/login", authLimiter);
app.use("/api/register", authLimiter);
app.use("/api/auth", authLimiter);
app.use("/api", apiLimiter);

// connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
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

// Routes
app.use("/api", authRoutes);
app.use("/api/igdb", igdbRoutes);
app.use("/api/library", libraryRoutes);
app.use("/api/users", userRoutes);
app.use("/api/profile-comments", profileCommentRoutes);
app.use("/api/friends", friendsRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server runs on http://localhost:${PORT}`);
});