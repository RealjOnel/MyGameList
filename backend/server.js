import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose"; // <-- hinzufügen
import authRoutes from './routes/auth.js';
import express from "express";
import cors from "cors";
import igdbRoutes from "./routes/igdb.js";

const app = express();

// MongoDB verbinden
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB verbunden"))
  .catch((err) => console.log("❌ MongoDB Fehler:", err));

app.use('/api', authRoutes);

app.get("/ping", (req, res) => {
  console.log("PING ROUTE HIT");
  res.send("SERVER PING OK");
});

app.use(cors());
app.use(express.json());

app.use("/api/igdb", igdbRoutes);

const PORT = 4000;

app.listen(PORT, () => {
  console.log(`🚀 Server läuft auf http://localhost:${PORT}`);
});