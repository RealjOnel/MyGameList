import express from "express";
console.log("✅ igdb routes loaded");
import axios from "axios";
import { getTwitchToken } from "../services/twitchToken.js";

const router = express.Router();

// How many games to return per Explore page
const EXPLORE_LIMIT = 50;

const GENRE_MAP = {
  all: null,
  shooter: 5,
  rpg: 12,
  adventure: 31,
  action: 4,
  strategy: 15,
  sports: 14,
  racing: 10,
  indie: 32,
};

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
//  NOTE: keep this route SIMPLE and RELIABLE.
//  We ask IGDB for games with a cover and then let the frontend
//  filter out weird editions / DLC by name.
router.get("/games", async (req, res) => {
  console.log("🔥 /games ROUTE HIT", req.query);
  try {
    const token = await getTwitchToken();

    const page = parseInt(req.query.page) || 1;
    // IGDB does not support a 'popularity' field on /games,
    // but it does support 'rating'. We treat 'rating' as our
    // default "popularity" proxy.
    const allowedSorts = ["name", "rating"];
    const sort = allowedSorts.includes(req.query.sort)
      ? req.query.sort
      : "rating";

    const order = sort === "rating" ? "desc" : "asc";
    const search = req.query.search;
    const genre = req.query.genre?.toLowerCase();

    const limit = EXPLORE_LIMIT;
    const offset = (page - 1) * limit;

    let whereClause = `cover != null`;
    if (search) {
      const safeSearch = String(search).replaceAll('"', '\\"');
      whereClause += ` & name ~ *"${safeSearch}"*`;
    }

    if (genre && GENRE_MAP[genre]) {
      whereClause += ` & genres = (${GENRE_MAP[genre]})`;
  }

    const response = await axios.post(
      "https://api.igdb.com/v4/games",
      `
        fields
          id,
          name,
          category,
          parent_game,
          version_parent,
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
          Authorization: `Bearer ${token}`,
        },
        timeout: 15000,
      }
    );

    res.json(response.data);
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).json({ error: "Explore Games fehlgeschlagen" });
  }
});

router.get("/", (req, res) => {
  res.send("IGDB ROUTER WORKS");
});

export default router;