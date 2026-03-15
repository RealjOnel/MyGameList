import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose"; // <-- add
import authRoutes from './routes/auth.js';
import express from "express";
import cors from "cors";
import igdbRoutes from "./routes/igdb.js";
import libraryRoutes from "./routes/library.js";
import userRoutes from "./routes/users.js";
import profileCommentRoutes from "./routes/profileComments.js";
import friendsRoutes from "./routes/friends.js";

const app = express();

app.set("etag", false);

// no caching for API
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.use(cors());
app.use(express.json());


// connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Connected");

    // reliably available after connection is open
    console.log("readyState:", mongoose.connection.readyState); // 1 = connected
    console.log("DB:", mongoose.connection.db?.databaseName);
    console.log("Host:", mongoose.connection.host);
  })
  .catch((err) => console.log("❌ MongoDB Error:", err));

app.get("/ping", (req, res) => {
  console.log("PING ROUTE HIT");
  res.send("SERVER PING OK");
});

app.use('/api', authRoutes);
app.use("/api/igdb", igdbRoutes);
app.use("/api/library", libraryRoutes);
app.use("/api/users", userRoutes);
app.use("/api/profile-comments", profileCommentRoutes);
app.use("/api/friends", friendsRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server runs on http://localhost:${PORT}`);
});