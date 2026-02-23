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

const PLATFORM_MAP = {
  all: null,

  // SONY
  ps1: 7,
  ps2: 8,
  ps3: 9,
  ps4: 48,
  ps5: 167,
  psp: 38,
  psvita: 46,
  psvr: 165,
  psvr2: 390,

  // MICROSOFT
  xbox: 11,
  xbox360: 12,
  xboxone: 49,
  xboxseries: 169,

  // SEGA
  sg1000: 84,
  mastersystem: 64,
  gamegear: 35,
  megadrive: 29,     // Mega Drive / Genesis
  segacd: 78,
  sega32x: 30,
  saturn: 32,
  dreamcast: 23,
  pico: 339,
  nomad: 29,         // IGDB: Nomad is "version" of Genesis → only filterable by "Genesis"

  // NINTENDO
  switch: 130,
  switch2: 508,
  wii: 5,
  wiiu: 41,
  virtualboy: 87,
  n64: 4,
  gcn: 21,
  nes: 18,
  snes: 19,
  gba: 24,
  gbc: 22,
  gb: 33,
  ds: 20,
  n3ds: 37,

  // PC / WEB / OTHER
  windows: 6,
  linux: 3,
  webbrowser: 82,
  amiga: 16,
  cpc: 25,

  // MOBILE
  mobile: [34, 39],  // Android + iOS

  // VR
  steamvr: 163,
  oculusvr: 162,     // "Oculus VR" (Rift/PC-VR)
  metaquest: [384, 386, 471], // Oculus Quest + Meta Quest 2 + Meta Quest 3
};

//  TRENDING GAMES (for Login Gallery)
router.get("/trending", async (req, res) => {
  try {
    const token = await getTwitchToken();

    const limit = Math.min(parseInt(req.query.limit || "12", 10), 30);

    // Default: IGDB Visits (popularity_type = 1)
    // Other types exist (2..8 etc). See /popularity_types. :contentReference[oaicite:3]{index=3}
    const popularityType = parseInt(req.query.type || "1", 10);

    //  Get top game_ids by popularity
    const popResp = await axios.post(
      "https://api.igdb.com/v4/popularity_primitives",
      `
        fields game_id,value,popularity_type;
        where popularity_type = ${popularityType};
        sort value desc;
        limit 60;
      `,
      {
        headers: {
          "Client-ID": process.env.TWITCH_CLIENT_ID,
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        timeout: 15000,
      }
    );

    const popList = Array.isArray(popResp.data) ? popResp.data : [];
    const orderedIds = [...new Set(popList.map(x => x.game_id).filter(Boolean))];

    if (orderedIds.length === 0) return res.json([]);

    const pool = orderedIds.slice(0, 60);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const pickedIds = pool.slice(0, limit);

    // Fetch game details for these ids (covers etc.)
    const idsStr = orderedIds.join(",");
    const gamesResp = await axios.post(
      "https://api.igdb.com/v4/games",
      `
        fields id,name,cover.image_id,rating;
        where id = (${idsStr}) & cover != null;
        limit 60;
      `,
      {
        headers: {
          "Client-ID": process.env.TWITCH_CLIENT_ID,
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        timeout: 15000,
      }
    );

    const games = Array.isArray(gamesResp.data) ? gamesResp.data : [];
    const byId = new Map(games.map(g => [g.id, g]));

    // Keep popularity order and cut to limit
    const result = [];
    for (const id of pickedIds) {
      const g = byId.get(id);
      if (!g?.cover?.image_id) continue;
      result.push(g);
      if (result.length >= limit) break;
    }


    res.set("Cache-Control", "no-store");
    res.json(result);
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).json({ error: "Trending Games failed" });
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

    // sort logic
    const allowedSorts = ["name", "rating"];
    const sort = allowedSorts.includes(String(req.query.sort))
      ? String(req.query.sort)
      : "rating";

    const requestedOrder = String(req.query.order || "").toLowerCase();
    const order = ["asc", "desc"].includes(requestedOrder)
      ? requestedOrder
      : (sort === "rating" ? "desc" : "asc");

    // Search logic
    const search = req.query.search;

    // Sort by Genre logic
    const genreKey = String(req.query.genre || "all").toLowerCase();
    const genreId = GENRE_MAP[genreKey];

    // Sort by Platform logic
    const platformKey = String(req.query.platform || "all").toLowerCase();
    const platformId = PLATFORM_MAP[platformKey];

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

    if (platformId != null) {
      whereClause += ` & platforms = (${platformId})`;
    } else if (platformKey !== "all") {
      console.warn("⚠️ Unknown platform key:", platformKey);
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