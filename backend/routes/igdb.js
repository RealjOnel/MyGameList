import express from "express";
console.log("✅ igdb routes loaded");
import axios from "axios";
import { getTwitchToken } from "../services/twitchToken.js";

const router = express.Router();

// How many games to return per Explore page
const EXPLORE_LIMIT = 50;

const GENRE_MAP = {
  all: null,
  pointandclick: 2,
  fighting: 4,
  shooter: 5,
  music: 7,
  platform: 8,
  puzzle: 9,
  racing: 10,
  rts: 11,              // Real Time Strategy (RTS)
  rpg: 12,              // Role-playing (RPG)
  simulator: 13,
  sport: 14,
  strategy: 15,
  tbs: 16,              // Turn-based strategy (TBS)
  tactical: 24,
  hackandslash: 25,     // Hack and slash/Beat 'em up
  quiz: 26,             // Quiz/Trivia
  pinball: 30,
  adventure: 31,
  indie: 32,
  arcade: 33,
  visualnovel: 34,
  cardandboard: 35,     // Card & Board Game
  moba: 36
};

//  TRENDING GAMES (for Login Gallery)
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

//  EXPLORE GAMES
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
    const genreKey = String(req.query.genre || "all").toLowerCase();
    const genreId = GENRE_MAP[genreKey];

    const limit = EXPLORE_LIMIT;
    const offset = (page - 1) * limit;

    let whereClause = `cover != null`;
    if (search) {
      const safeSearch = String(search).replaceAll('"', '\\"');
      whereClause += ` & name ~ *"${safeSearch}"*`;
    }

    if (genreId != null) {
      whereClause += ` & genres = (${genreId})`;
    } else if (genreKey !== "all") {
      console.warn("⚠️ Unknown genre key:", genreKey);
    }

    const response = await axios.post(
      "https://api.igdb.com/v4/games",
      `
        fields
          id,
          name,
          category,
          first_release_date,
          parent_game,
          version_parent,
          cover.image_id,
          genres.name,
          release_dates.date,
          release_dates.platform.name,
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