import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose"; // <-- add
import authRoutes from './routes/auth.js';
import express from "express";
import cors from "cors";
import igdbRoutes from "./routes/igdb.js";
import libraryRoutes from "./routes/library.js";

const app = express();

app.use(cors());
app.use(express.json());


// connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("❌ MongoDB Error:", err));

app.get("/ping", (req, res) => {
  console.log("PING ROUTE HIT");
  res.send("SERVER PING OK");
});

app.use('/api', authRoutes);
app.use("/api/igdb", igdbRoutes);
app.use("/api/library", libraryRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server runs on http://localhost:${PORT}`);
});