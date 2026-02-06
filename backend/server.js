import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import igdbRoutes from "./routes/igdb.js";

const app = express();

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