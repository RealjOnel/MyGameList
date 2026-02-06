import dotenv from "dotenv";
dotenv.config();

import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

let accessToken = null;
let tokenExpiresAt = 0;

// Token-Funktion
async function getTwitchToken() {
  if (accessToken && Date.now() < tokenExpiresAt) {
    return accessToken;
  }

  const response = await axios.post(
    "https://id.twitch.tv/oauth2/token",
    new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      grant_type: "client_credentials"
    })
  );

  accessToken = response.data.access_token;
  tokenExpiresAt = Date.now() + response.data.expires_in * 1000;

  console.log("🟣 Twitch Token refreshed");
  return accessToken;
}

// IGDB Route
app.get("/api/trending-games", async (req, res) => {
  try {
    const token = await getTwitchToken();

    const response = await axios.post(
      "https://api.igdb.com/v4/games",
      "fields name, cover.image_id, rating; where rating > 80 & cover != null; limit 12; sort rating desc;",
      {
        headers: {
          "Client-ID": process.env.TWITCH_CLIENT_ID,
          "Authorization": `Bearer ${token}`
        }
      }
    );

    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: "IGDB Abfrage fehlgeschlagen" });
  }
});

app.listen(3000, () =>
  console.log("🚀 Server läuft auf http://localhost:3000")
);