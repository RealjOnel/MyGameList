import express from "express";
console.log("✅ igdb routes loaded");
import axios from "axios";
import { getTwitchToken } from "../services/twitchToken.js";

const router = express.Router();

//  TRENDING GAMES (für Login-Galerie)
router.get("/trending", async (req, res) => {
  try {
    const token = await getTwitchToken();

    const response = await axios.post(
      "https://api.igdb.com/v4/games",
      `
        fields id, name, cover.image_id, rating;
        where rating > 80 & cover != null;
        sort rating desc;
        limit 12;
      `,
      {
        headers: {
          "Client-ID": process.env.TWITCH_CLIENT_ID,
          "Authorization": `Bearer ${token}`
        }
      }
    );

    res.json(response.data);
  } catch {
    res.status(500).json({ error: "Trending Games fehlgeschlagen" });
  }
});

//  EXPLORE GAMES (größere Liste)
router.get("/games", async (req, res) => {
  try {
    const token = await getTwitchToken();

    const page = parseInt(req.query.page) || 1;
    const allowedSorts = ["name"];
    const sort = allowedSorts.includes(req.query.sort)
        ? req.query.sort
        : "name";

    const order = req.query.order === "desc" ? "desc" : "asc";
    const search = req.query.search;
    const limit = 50;
    const offset = (page - 1) * limit;
    let whereClause =
      "cover != null & (category = 0 | category = 8 | category = 9)";

    if (search) {
      whereClause += ` & name ~ *"${search}"*`;
    }

    const response = await axios.post(
      "https://api.igdb.com/v4/games",
      `
        fields 
            id, 
            name, 
            cover.image_id,
            genres.name,
            involved_companies.company.name,
            involved_companies.developer,
            involved_companies.publisher;
        where ${whereClause};
        sort ${sort} ${order};
        limit ${limit};
        offset ${offset};
      `,
      {
        headers: {
          "Client-ID": process.env.TWITCH_CLIENT_ID,
          Authorization: `Bearer ${token}`
        }
      }
    );

    res.json(response.data);
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).json({ error: "Explore Games fehlgeschlagen" });
  }
});

export default router;

router.get("/", (req, res) => {
  res.send("IGDB ROUTER WORKS");
});