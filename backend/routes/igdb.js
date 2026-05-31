import express from "express";
import axios from "axios";
import { getTwitchToken } from "../services/twitchToken.js";

const router = express.Router();

const EXPLORE_LIMIT = 50;
const MAX_SEARCH_LENGTH = 80;
const MAX_PAGE = 200;
const MAX_TRENDING_LIMIT = 30;
const MAX_POPULARITY_TYPE = 50;
const MAX_GAME_ID = 2_147_483_647;

const DEFAULT_SUGGESTION_LIMIT = 10;
const MAX_SUGGESTION_LIMIT = 15;
const SUGGESTION_FETCH_LIMIT = 25;

const SUGGESTION_BANNED_NAME_PATTERNS = [
  /\bexpansion pass\b/i,
  /\bseason pass\b/i,
  /\bsoundtrack\b/i,
  /\bartbook\b/i,
  /\bbundle\b/i,
  /\bcollection\b/i,
  /\bcomplete edition\b/i,
  /\bcollector'?s edition\b/i,
  /\bdeluxe\b/i,
  /\bdefinitive\b/i,
  /\bultimate\b/i,
  /\bgame of the year\b/i,
  /\bgoty\b/i,
  /\b dlc\b/i,
  /^dlc\b/i
];

const GENRE_MAP = {
  all: null,
  pointandclick: 2,
  fighting: 4,
  shooter: 5,
  music: 7,
  platform: 8,
  puzzle: 9,
  racing: 10,
  rts: 11,
  rpg: 12,
  simulator: 13,
  sport: 14,
  strategy: 15,
  tbs: 16,
  tactical: 24,
  hackandslash: 25,
  quiz: 26,
  pinball: 30,
  adventure: 31,
  indie: 32,
  arcade: 33,
  visualnovel: 34,
  cardandboard: 35,
  moba: 36
};

const PLATFORM_MAP = {
  all: null,

  ps1: 7,
  ps2: 8,
  ps3: 9,
  ps4: 48,
  ps5: 167,
  psp: 38,
  psvita: 46,
  psvr: 165,
  psvr2: 390,

  xbox: 11,
  xbox360: 12,
  xboxone: 49,
  xboxseries: 169,

  sg1000: 84,
  mastersystem: 64,
  gamegear: 35,
  megadrive: 29,
  segacd: 78,
  sega32x: 30,
  saturn: 32,
  dreamcast: 23,
  pico: 339,
  nomad: 29,

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

  windows: 6,
  linux: 3,
  webbrowser: 82,
  amiga: 16,
  cpc: 25,

  mobile: [34, 39],

  steamvr: 163,
  oculusvr: 162,
  metaquest: [384, 386, 471],
};

function getIgdbHeaders(token) {
  return {
    "Client-ID": process.env.TWITCH_CLIENT_ID,
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
}

function parseBoundedInt(value, { defaultValue, min, max, fieldName }) {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: defaultValue };
  }

  const n = Number.parseInt(String(value), 10);

  if (!Number.isInteger(n)) {
    return { ok: false, message: `Invalid ${fieldName}` };
  }

  if (n < min || n > max) {
    return { ok: false, message: `${fieldName} must be between ${min} and ${max}` };
  }

  return { ok: true, value: n };
}

function parseEnumKey(value, map, fieldName) {
  const raw = String(value ?? "all").trim().toLowerCase();

  if (!(raw in map)) {
    return { ok: false, message: `Invalid ${fieldName}` };
  }

  return { ok: true, key: raw, value: map[raw] };
}

function sanitizeSearchInput(value = "") {
  const cleaned = String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim()
    .slice(0, MAX_SEARCH_LENGTH);

  return cleaned;
}

function escapeIgdbString(value = "") {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .trim();
}

function stripDiacritics(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeLooseSearch(value = "") {
  return stripDiacritics(String(value))
    .replace(/['’`]/g, "")
    .replace(/[.:\-–—_/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildTokenVariants(token = "") {
  const base = normalizeLooseSearch(token).replace(/\s+/g, "").trim();
  if (!base) return [];

  const variants = new Set([base]);

  if (base.length === 2) {
    return [base];
  }

  if (base.endsWith("s") && base.length > 3) {
    variants.add(base.slice(0, -1));
  }

  if (base.length >= 7) {
    variants.add(base.slice(0, 4));
    variants.add(base.slice(0, 3));
  }

  return [...variants].filter(v => v.length >= 2);
}

function buildLooseMatchClauses(field, rawValue) {
  const raw = sanitizeSearchInput(rawValue);
  if (!raw) return [];

  const normalized = normalizeLooseSearch(raw);
  const clauses = new Set();

  clauses.add(`${field} ~ *"${escapeIgdbString(raw)}"*`);

  if (normalized && normalized !== raw) {
    clauses.add(`${field} ~ *"${escapeIgdbString(normalized)}"*`);
  }

  const tokens = normalized.split(" ").filter(Boolean).slice(0, 6);

  const tokenGroups = tokens
    .map(token => {
      const tokenVariants = buildTokenVariants(token);
      if (!tokenVariants.length) return null;

      if (tokenVariants.length === 1) {
        return `${field} ~ *"${escapeIgdbString(tokenVariants[0])}"*`;
      }

      return `(${tokenVariants
        .map(v => `${field} ~ *"${escapeIgdbString(v)}"*`)
        .join(" | ")})`;
    })
    .filter(Boolean);

  if (tokenGroups.length) {
    clauses.add(`(${tokenGroups.join(" & ")})`);
  }

  return [...clauses];
}

function normalizeSearchScore(value = "") {
  return normalizeLooseSearch(String(value || "").toLowerCase());
}

function extractEntityIds(list) {
  return [...new Set(
    (Array.isArray(list) ? list : [])
      .map(item => Number(item?.id ?? item))
      .filter(Number.isFinite)
  )];
}

function shouldExcludeSuggestionGame(game) {
  const category = Number(game?.category);
  const name = String(game?.name || "").trim();

  if ([1, 2, 3, 4, 5, 6, 7].includes(category)) {
    return true;
  }

  return SUGGESTION_BANNED_NAME_PATTERNS.some((pattern) => pattern.test(name));
}

function getSuggestionScore(game, rawQuery) {
  const q = normalizeSearchScore(rawQuery);
  const name = normalizeSearchScore(game?.name || "");

  if (!q || !name) return 999;

  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  if (name.includes(` ${q}`)) return 2;
  if (name.includes(q)) return 3;

  return 4;
}

async function fetchExpandedAgeRatingsByIds(ids, headers) {
  const uniqueIds = extractEntityIds(ids);
  if (!uniqueIds.length) return [];

  const ageResp = await axios.post(
    "https://api.igdb.com/v4/age_ratings",
    `
      fields
        id,
        category,
        rating,
        organization,
        rating_category,
        rating_cover_url,
        synopsis;
      where id = (${uniqueIds.join(",")});
      limit ${uniqueIds.length};
    `,
    { headers, timeout: 15000 }
  );

  return Array.isArray(ageResp.data) ? ageResp.data : [];
}

async function fetchAgeRatingCategoriesByIds(ids, headers) {
  const uniqueIds = [...new Set(
    (Array.isArray(ids) ? ids : [])
      .map(x => Number(x))
      .filter(Number.isFinite)
  )];

  if (!uniqueIds.length) return [];

  const resp = await axios.post(
    "https://api.igdb.com/v4/age_rating_categories",
    `
      fields id,organization,rating;
      where id = (${uniqueIds.join(",")});
      limit ${uniqueIds.length};
    `,
    { headers, timeout: 15000 }
  );

  return Array.isArray(resp.data) ? resp.data : [];
}

async function enrichAgeRatingsWithCategoryRefs(ageRatings, headers) {
  const list = Array.isArray(ageRatings) ? ageRatings : [];
  if (!list.length) return [];

  const ratingCategoryIds = list
    .map(r => Number(r?.rating_category))
    .filter(Number.isFinite);

  const ratingCategories = await fetchAgeRatingCategoriesByIds(ratingCategoryIds, headers);
  const ratingCategoryById = new Map(ratingCategories.map(x => [x.id, x]));

  return list.map(r => ({
    ...r,
    rating_category_ref: ratingCategoryById.get(Number(r?.rating_category)) || null
  }));
}

async function fetchAgeRatingsForGameId(gameId, headers) {
  const numericGameId = Number(gameId);
  if (!Number.isFinite(numericGameId)) return [];

  const gameRefResp = await axios.post(
    "https://api.igdb.com/v4/games",
    `
      fields age_ratings;
      where id = ${numericGameId};
      limit 1;
    `,
    { headers, timeout: 15000 }
  );

  const refGame = Array.isArray(gameRefResp.data) ? gameRefResp.data[0] : null;
  const ids = extractEntityIds(refGame?.age_ratings);

  return fetchExpandedAgeRatingsByIds(ids, headers);
}

async function fetchGamesByCompanySearch(query, headers) {
  const raw = sanitizeSearchInput(query);
  if (!raw) return [];

  const clauses = buildLooseMatchClauses("name", raw);
  if (!clauses.length) return [];

  const companiesResp = await axios.post(
    "https://api.igdb.com/v4/companies",
    `
      fields id,name;
      where ${clauses.join(" | ")};
      limit 20;
    `,
    { headers, timeout: 15000 }
  );

  const companies = Array.isArray(companiesResp.data) ? companiesResp.data : [];
  const companyIds = companies.map(c => c.id).filter(Boolean);

  if (!companyIds.length) return [];

  const gamesResp = await axios.post(
    "https://api.igdb.com/v4/games",
    `
      fields
        id,
        name,
        rating,
        rating_count,
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
      where cover != null & involved_companies.company = (${companyIds.join(",")});
      limit 80;
    `,
    { headers, timeout: 15000 }
  );

  return Array.isArray(gamesResp.data) ? gamesResp.data : [];
}

// Upcoming Games Related helpers and constants
const UPCOMING_LIMIT_DEFAULT = 120;
const UPCOMING_LIMIT_MAX = 240;
const UPCOMING_RELEASE_FETCH_MAX = 500;
const UPCOMING_RELEASE_FETCH_MULTIPLIER = 3;
const UPCOMING_GAME_CHUNK = 100;

const UPCOMING_BANNED_PATTERNS = [
  /collector/i,
  /collector's/i,
  /soundtrack/i,
  /artbook/i,
  /case/i,
  /steelbook/i,
  /special/i,
  /figurine/i,
  /statue/i,
  /\bpack\b/i,
  /\bbundle\b/i,
  /\bdlc\b/i,
  /character pack/i,
  /\bseason pass\b/i,
  /\bgame of the year\b/i,
  /\bgoty\b/i,
  /\bultimate( edition)?\b/i,
  /\bcomplete( edition)?\b/i,
  /\bdefinitive( edition)?\b/i,
  /\bdeluxe( edition)?\b/i,
  /\bpremium( edition)?\b/i,
];

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function uniqStrings(items = []) {
  return [...new Set(
    (Array.isArray(items) ? items : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  )];
}

function getDeveloperName(game) {
  return (
    game?.involved_companies?.find((c) => c?.developer)?.company?.name ||
    game?.involved_companies?.find((c) => c?.publisher)?.company?.name ||
    "Unknown Studio"
  );
}

function parseQuarterFromHuman(human = "") {
  const text = String(human || "").toUpperCase();

  if (text.includes("Q1")) return 1;
  if (text.includes("Q2")) return 2;
  if (text.includes("Q3")) return 3;
  if (text.includes("Q4")) return 4;

  return null;
}

function getQuarterFromRelease(release) {
  const month = Number(release?.m);

  if (Number.isInteger(month) && month >= 1 && month <= 12) {
    return Math.floor((month - 1) / 3) + 1;
  }

  return parseQuarterFromHuman(release?.human);
}

function getYearFromRelease(release) {
  const year = Number(release?.y);

  if (Number.isInteger(year) && year > 0) {
    return year;
  }

  const timestamp = Number(release?.date);
  if (Number.isFinite(timestamp) && timestamp > 0) {
    return new Date(timestamp * 1000).getUTCFullYear();
  }

  return null;
}

function isUpcomingMainGame(game) {
  if (!game?.id || !game?.name) return false;
  if (!game?.cover?.image_id) return false;
  if (game?.version_parent) return false;

  const excludedCategories = new Set([1, 2, 3, 4, 5, 6, 7]);
  if (excludedCategories.has(Number(game?.category))) {
    return false;
  }

  return !UPCOMING_BANNED_PATTERNS.some((rx) => rx.test(game.name));
}

async function fetchGamesByIds(ids, headers) {
  const chunks = chunkArray(ids, UPCOMING_GAME_CHUNK);
  const out = [];

  for (const chunk of chunks) {
    const resp = await axios.post(
      "https://api.igdb.com/v4/games",
      `
        fields
          id,
          name,
          category,
          version_parent,
          first_release_date,
          cover.image_id,
          genres.name,
          platforms.name,
          involved_companies.company.name,
          involved_companies.developer,
          involved_companies.publisher;
        where id = (${chunk.join(",")}) & cover != null;
        limit ${chunk.length};
      `,
      { headers, timeout: 15000 }
    );

    const games = Array.isArray(resp.data) ? resp.data : [];
    out.push(...games);
  }

  return out;
}

// TRENDING GAMES
router.get("/trending", async (req, res) => {
  try {
    const limitResult = parseBoundedInt(req.query.limit, {
      defaultValue: 12,
      min: 1,
      max: MAX_TRENDING_LIMIT,
      fieldName: "limit"
    });
    if (!limitResult.ok) {
      return res.status(400).json({ error: limitResult.message });
    }

    const typeResult = parseBoundedInt(req.query.type, {
      defaultValue: 1,
      min: 1,
      max: MAX_POPULARITY_TYPE,
      fieldName: "type"
    });
    if (!typeResult.ok) {
      return res.status(400).json({ error: typeResult.message });
    }

    const token = await getTwitchToken();
    const headers = getIgdbHeaders(token);

    const popResp = await axios.post(
      "https://api.igdb.com/v4/popularity_primitives",
      `
        fields game_id,value,popularity_type;
        where popularity_type = ${typeResult.value};
        sort value desc;
        limit 60;
      `,
      { headers, timeout: 15000 }
    );

    const popList = Array.isArray(popResp.data) ? popResp.data : [];
    const orderedIds = [...new Set(popList.map(x => x.game_id).filter(Boolean))];

    if (orderedIds.length === 0) {
      res.set("Cache-Control", "no-store");
      return res.json([]);
    }

    const pool = orderedIds.slice(0, 60);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const pickedIds = pool.slice(0, limitResult.value);

    const idsStr = pickedIds.join(",");
    const gamesResp = await axios.post(
      "https://api.igdb.com/v4/games",
      `
        fields id,name,cover.image_id,rating;
        where id = (${idsStr}) & cover != null;
        limit ${pickedIds.length};
      `,
      { headers, timeout: 15000 }
    );

    const games = Array.isArray(gamesResp.data) ? gamesResp.data : [];
    const byId = new Map(games.map(g => [g.id, g]));

    const result = [];
    for (const id of pickedIds) {
      const g = byId.get(id);
      if (!g?.cover?.image_id) continue;
      result.push(g);
      if (result.length >= limitResult.value) break;
    }

    res.set("Cache-Control", "no-store");
    res.json(result);
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).json({ error: "Trending games failed" });
  }
});

// FAST SEARCH SUGGESTIONS FOR NAVBAR
router.get("/search-suggestions", async (req, res) => {
  try {
    const q = sanitizeSearchInput(req.query.q || "");

    if (q.length < 2) {
      res.set("Cache-Control", "no-store");
      return res.json([]);
    }

    const limitResult = parseBoundedInt(req.query.limit, {
      defaultValue: DEFAULT_SUGGESTION_LIMIT,
      min: 1,
      max: MAX_SUGGESTION_LIMIT,
      fieldName: "limit"
    });

    if (!limitResult.ok) {
      return res.status(400).json({ error: limitResult.message });
    }

    const token = await getTwitchToken();
    const headers = getIgdbHeaders(token);

    const escapedQuery = escapeIgdbString(q);

    const response = await axios.post(
      "https://api.igdb.com/v4/games",
      `
        search "${escapedQuery}";
        fields
          id,
          name,
          category,
          cover.image_id,
          genres.name,
          involved_companies.company.name,
          involved_companies.developer,
          involved_companies.publisher;
        where cover != null;
        limit ${SUGGESTION_FETCH_LIMIT};
      `,
      { headers, timeout: 10000 }
    );

    let games = Array.isArray(response.data) ? response.data : [];

    games = games
      .filter((game) => game?.id && game?.name && game?.cover?.image_id)
      .filter((game) => !shouldExcludeSuggestionGame(game))
      .sort((a, b) => {
        const aScore = getSuggestionScore(a, q);
        const bScore = getSuggestionScore(b, q);

        if (aScore !== bScore) return aScore - bScore;

        return String(a?.name || "").localeCompare(String(b?.name || ""));
      })
      .slice(0, limitResult.value);

    res.set("Cache-Control", "no-store");
    return res.json(games);
  } catch (err) {
    console.error(err.response?.data || err);
    return res.status(500).json({ error: "Search suggestions failed" });
  }
});

// EXPLORE GAMES
router.get("/games", async (req, res) => {
  try {
    const pageResult = parseBoundedInt(req.query.page, {
      defaultValue: 1,
      min: 1,
      max: MAX_PAGE,
      fieldName: "page"
    });
    if (!pageResult.ok) {
      return res.status(400).json({ error: pageResult.message });
    }

    const genreResult = parseEnumKey(req.query.genre, GENRE_MAP, "genre");
    if (!genreResult.ok) {
      return res.status(400).json({ error: genreResult.message });
    }

    const platformResult = parseEnumKey(req.query.platform, PLATFORM_MAP, "platform");
    if (!platformResult.ok) {
      return res.status(400).json({ error: platformResult.message });
    }

    const token = await getTwitchToken();
    const headers = getIgdbHeaders(token);

    const allowedSorts = ["name", "rating"];
    const sort = allowedSorts.includes(String(req.query.sort || "").trim())
      ? String(req.query.sort).trim()
      : "rating";

    const requestedOrder = String(req.query.order || "").trim().toLowerCase();
    const order = ["asc", "desc"].includes(requestedOrder)
      ? requestedOrder
      : (sort === "rating" ? "desc" : "asc");

    const search = sanitizeSearchInput(req.query.search || "");
    const limit = EXPLORE_LIMIT;
    const offset = (pageResult.value - 1) * limit;

    let whereClause = `cover != null`;

    if (search) {
      const nameClauses = buildLooseMatchClauses("name", search);
      if (nameClauses.length) {
        whereClause += ` & (${nameClauses.join(" | ")})`;
      }
    }

    if (genreResult.value != null) {
      whereClause += ` & genres = (${genreResult.value})`;
    }

    if (platformResult.value != null) {
      whereClause += ` & platforms = (${platformResult.value})`;
    }

    const response = await axios.post(
      "https://api.igdb.com/v4/games",
      `
        fields
          id,
          name,
          rating,
          rating_count,
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
      { headers, timeout: 15000 }
    );

    let games = Array.isArray(response.data) ? response.data : [];

    if (search) {
      try {
        const companyGames = await fetchGamesByCompanySearch(search, headers);
        const merged = new Map();

        for (const g of [...games, ...companyGames]) {
          if (g?.id) merged.set(g.id, g);
        }

        games = [...merged.values()];
      } catch (e) {
        console.warn("company search failed:", e.response?.data || e.message);
      }
    }

    if (search) {
      const q = normalizeSearchScore(search);

      games = games.sort((a, b) => {
        const aName = normalizeSearchScore(a.name || "");
        const bName = normalizeSearchScore(b.name || "");

        const aCompanies = (a.involved_companies || [])
          .map(c => normalizeSearchScore(c?.company?.name || ""))
          .filter(Boolean);

        const bCompanies = (b.involved_companies || [])
          .map(c => normalizeSearchScore(c?.company?.name || ""))
          .filter(Boolean);

        function score(name, companies) {
          if (name === q) return 0;
          if (name.startsWith(q)) return 1;
          if (name.includes(" " + q)) return 2;
          if (name.includes(q)) return 3;

          if (companies.some(c => c === q)) return 4;
          if (companies.some(c => c.includes(q))) return 5;

          return 6;
        }

        const aScore = score(aName, aCompanies);
        const bScore = score(bName, bCompanies);

        if (aScore !== bScore) return aScore - bScore;

        const aRating = Number.isFinite(a?.rating) ? a.rating : -1;
        const bRating = Number.isFinite(b?.rating) ? b.rating : -1;
        if (aRating !== bRating) return bRating - aRating;

        const aCount = Number.isFinite(a?.rating_count) ? a.rating_count : -1;
        const bCount = Number.isFinite(b?.rating_count) ? b.rating_count : -1;
        return bCount - aCount;
      });
    }

    res.set("Cache-Control", "no-store");
    res.json(games.slice(0, limit));
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).json({ error: "Explore games failed" });
  }
});

// UPCOMING GAMES
router.get("/upcoming", async (req, res) => {
  try {
    const limitResult = parseBoundedInt(req.query.limit, {
      defaultValue: UPCOMING_LIMIT_DEFAULT,
      min: 1,
      max: UPCOMING_LIMIT_MAX,
      fieldName: "limit"
    });

    if (!limitResult.ok) {
      return res.status(400).json({ error: limitResult.message });
    }

    const token = await getTwitchToken();
    const headers = getIgdbHeaders(token);

    const nowUnix = Math.floor(Date.now() / 1000);
    const requestedLimit = limitResult.value;

    const releaseFetchLimit = Math.min(
      Math.max(requestedLimit * UPCOMING_RELEASE_FETCH_MULTIPLIER, requestedLimit),
      UPCOMING_RELEASE_FETCH_MAX
    );

    const releaseResp = await axios.post(
      "https://api.igdb.com/v4/release_dates",
      `
        fields
          game,
          date,
          human,
          y,
          m,
          d,
          platform,
          status,
          release_region,
          date_format;
        where game != null & date > ${nowUnix};
        sort date asc;
        limit ${releaseFetchLimit};
      `,
      { headers, timeout: 15000 }
    );

    const releaseDates = Array.isArray(releaseResp.data) ? releaseResp.data : [];

    const earliestReleaseByGameId = new Map();

    for (const release of releaseDates) {
      const gameId = Number(release?.game);
      const releaseDate = Number(release?.date);

      if (!Number.isFinite(gameId) || !Number.isFinite(releaseDate)) {
        continue;
      }

      const current = earliestReleaseByGameId.get(gameId);

      if (!current || releaseDate < Number(current.date)) {
        earliestReleaseByGameId.set(gameId, release);
      }
    }

    const gameIds = [...earliestReleaseByGameId.keys()];
    if (!gameIds.length) {
      res.set("Cache-Control", "no-store");
      return res.json([]);
    }

    const games = await fetchGamesByIds(gameIds, headers);

    const mapped = games
      .filter(isUpcomingMainGame)
      .map((game) => {
        const release = earliestReleaseByGameId.get(game.id);
        const releaseDate = Number(release?.date);

        if (!Number.isFinite(releaseDate)) {
          return null;
        }

        const year = getYearFromRelease(release);
        const quarter = getQuarterFromRelease(release);
        const daysUntil = Math.max(0, Math.ceil((releaseDate - nowUnix) / 86400));

        return {
          id: game.id,
          name: game.name || "Unknown",
          coverImageId: game?.cover?.image_id || null,
          developer: getDeveloperName(game),
          genres: uniqStrings((game.genres || []).map((g) => g?.name)),
          platforms: uniqStrings((game.platforms || []).map((p) => p?.name)),
          releaseDate,
          releaseHuman: String(release?.human || "").trim(),
          releaseYear: year,
          releaseQuarter: quarter,
          daysUntil,
          firstReleaseDate: Number(game?.first_release_date) || null
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.releaseDate - b.releaseDate)
      .slice(0, limitResult.value);

    res.set("Cache-Control", "no-store");
    return res.json(mapped);
  } catch (err) {
    console.error(err.response?.data || err);
    return res.status(500).json({ error: "Upcoming games failed" });
  }
});

// GAME DETAILS
router.get("/game/:id", async (req, res) => {
  try {
    const idResult = parseBoundedInt(req.params.id, {
      defaultValue: null,
      min: 1,
      max: MAX_GAME_ID,
      fieldName: "game id"
    });
    if (!idResult.ok) {
      return res.status(400).json({ error: idResult.message });
    }

    const token = await getTwitchToken();
    const headers = getIgdbHeaders(token);
    const id = idResult.value;

    const gameResp = await axios.post(
      "https://api.igdb.com/v4/games",
      `
        fields
          id, name,
          age_ratings,

          parent_game.id, parent_game.name, parent_game.cover.image_id, parent_game.first_release_date,
          version_parent.id, version_parent.name, version_parent.cover.image_id, version_parent.first_release_date,

          summary, storyline,
          rating, aggregated_rating, total_rating, total_rating_count,
          first_release_date,

          cover.image_id,
          genres.name,
          platforms.name,

          game_modes.name,
          themes.name,
          player_perspectives.name,
          franchise.name,
          collection.name,
          keywords.name,
          websites.url, websites.category,

          involved_companies.developer,
          involved_companies.publisher,
          involved_companies.company.name,

          videos.video_id,
          videos.name,

          release_dates.date,
          release_dates.platform.name,
          release_dates.region,

          similar_games.id, similar_games.name, similar_games.cover.image_id, similar_games.first_release_date,
          dlcs.id, dlcs.name, dlcs.cover.image_id,
          expansions.id, expansions.name, expansions.cover.image_id,
          remakes.id, remakes.name, remakes.cover.image_id,
          remasters.id, remasters.name, remasters.cover.image_id,
          ports.id, ports.name, ports.cover.image_id;
        where id = ${id};
        limit 1;
      `,
      { headers, timeout: 15000 }
    );

    const game = Array.isArray(gameResp.data) ? gameResp.data[0] : null;
    if (!game) return res.status(404).json({ error: "Game not found" });

    const baseId =
      Number(game?.version_parent?.id) ||
      Number(game?.parent_game?.id) ||
      Number(game?.id);

    // Resolve age rating reference IDs into full age rating objects
    try {
      const directAgeRatingIds = extractEntityIds(game?.age_ratings);
      let expandedAgeRatings = await fetchExpandedAgeRatingsByIds(directAgeRatingIds, headers);

      if (!expandedAgeRatings.length && Number.isFinite(baseId) && baseId !== Number(game?.id)) {
        expandedAgeRatings = await fetchAgeRatingsForGameId(baseId, headers);
      }

      game.age_ratings = await enrichAgeRatingsWithCategoryRefs(expandedAgeRatings, headers);
    } catch (e) {
      console.warn("age ratings fetch failed:", e.response?.data || e.message);
      game.age_ratings = [];
    }

    game.characters = [];

    if (Number.isFinite(baseId)) {
      try {
        const withImgResp = await axios.post(
          "https://api.igdb.com/v4/characters",
          `
            fields id,name,mug_shot.image_id;
            where games = (${baseId}) & mug_shot != null;
            limit 60;
          `,
          { headers, timeout: 15000 }
        );

        const withImg = Array.isArray(withImgResp.data) ? withImgResp.data : [];

        if (withImg.length > 0) {
          game.characters = withImg;
        } else {
          const anyResp = await axios.post(
            "https://api.igdb.com/v4/characters",
            `
              fields id,name,mug_shot.image_id;
              where games = (${baseId});
              limit 60;
            `,
            { headers, timeout: 15000 }
          );

          game.characters = Array.isArray(anyResp.data) ? anyResp.data : [];
        }
      } catch (e) {
        console.warn("characters fetch failed:", e.response?.data || e.message);
        game.characters = [];
      }
    }

    const ttbGameId = baseId;

    if (!Number.isFinite(ttbGameId)) {
      game.time_to_beat = null;
      res.set("Cache-Control", "no-store");
      return res.json(game);
    }

    const ttbResp = await axios.post(
      "https://api.igdb.com/v4/game_time_to_beats",
      `
        fields hastily,normally,completely,count;
        where game_id = ${ttbGameId};
        sort count desc;
        limit 1;
      `,
      { headers, timeout: 15000 }
    );

    const ttb = Array.isArray(ttbResp.data) ? ttbResp.data[0] : null;

    game.time_to_beat = ttb
      ? {
          hastily: Number(ttb.hastily) || 0,
          normally: Number(ttb.normally) || 0,
          completely: Number(ttb.completely) || 0,
          count: Number(ttb.count) || 0,
          source_game_id: ttbGameId,
        }
      : null;

    res.set("Cache-Control", "no-store");
    res.json(game);
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).json({ error: "Game detail failed" });
  }
});

router.get("/", (req, res) => {
  res.send("IGDB ROUTER WORKS");
});

export default router;