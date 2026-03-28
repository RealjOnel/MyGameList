import express from "express";
import axios from "axios";
import { z } from "zod";
import { requireAuth } from "../middleware/authMiddleware.js";
import { getTwitchToken } from "../services/twitchToken.js";
import { Game } from "../models/game.js";
import { UserGameEntry } from "../models/userGameEntry.js";
import { User } from "../models/user.js";

const router = express.Router();

const ALLOWED_STATUSES = new Set([
  "planned",
  "playing",
  "completed",
  "on_hold",
  "dropped"
]);

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username is required")
  .max(20, "Username is too long");

function normalizeUsername(rawValue = "") {
  return String(rawValue || "").trim().toLowerCase();
}

function parseUsername(value) {
  const parsed = usernameSchema.safeParse(value);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message || "Invalid username"
    };
  }

  return {
    ok: true,
    value: parsed.data,
    normalizedValue: normalizeUsername(parsed.data)
  };
}

function isValidStatus(value) {
  return typeof value === "string" && ALLOWED_STATUSES.has(value);
}

function parseValidatedRating(value) {
  if (value === null) {
    return { ok: true, value: null };
  }

  if (value === undefined) {
    return { ok: true, value: undefined };
  }

  const n = Number(value);

  if (!Number.isInteger(n)) {
    return {
      ok: false,
      message: "Rating must be a whole number between 1 and 10 or null."
    };
  }

  if (n < 1 || n > 10) {
    return {
      ok: false,
      message: "Rating must be between 1 and 10."
    };
  }

  return { ok: true, value: n };
}

/**
 * Helper: fetch a minimal game payload from IGDB (when not in DB yet)
 */
async function fetchGameFromIGDB(igdbId) {
  const token = await getTwitchToken();
  const headers = {
    "Client-ID": process.env.TWITCH_CLIENT_ID,
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };

  const resp = await axios.post(
    "https://api.igdb.com/v4/games",
    `
      fields id,name,cover.image_id,summary,storyline,first_release_date,genres.name,platforms.name,rating,aggregated_rating;
      where id = ${igdbId};
      limit 1;
    `,
    { headers, timeout: 15000 }
  );

  const g = Array.isArray(resp.data) ? resp.data[0] : null;
  if (!g) return null;

  return {
    igdbId: g.id,
    name: g.name ?? "Unknown",
    coverImageId: g?.cover?.image_id ?? null,
    summary: g?.summary ?? "",
    storyline: g?.storyline ?? "",
    firstReleaseDate: g.first_release_date ? new Date(g.first_release_date * 1000) : null,
    genres: (g.genres || []).map(x => x?.name).filter(Boolean),
    platforms: (g.platforms || []).map(x => x?.name).filter(Boolean),
    igdbRating: Number.isFinite(g.rating) ? g.rating : null,
    metacriticRating: Number.isFinite(g.aggregated_rating) ? g.aggregated_rating : null,
    lastSyncedAt: new Date(),
  };
}

/**
 * POST /api/library/add
 * body: { igdbId, status? }
 */
router.post("/add", requireAuth, async (req, res) => {
  try {
    const igdbId = Number(req.body.igdbId);
    const status = req.body.status;

    if (!Number.isFinite(igdbId)) {
      return res.status(400).json({ message: "Invalid igdbId" });
    }

    if (status !== undefined && !isValidStatus(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    // 1) ensure game exists in our DB (cache)
    let game = await Game.findOne({ igdbId });
    if (!game) {
      const data = await fetchGameFromIGDB(igdbId);
      if (!data) return res.status(404).json({ message: "Game not found on IGDB" });
      game = await Game.create(data);
    }

    // 2) create list entry (unique per user+game)
    const entry = await UserGameEntry.findOneAndUpdate(
      { userId: req.userId, gameId: game._id },
      { $setOnInsert: { userId: req.userId, gameId: game._id, status: status || "planned" } },
      { upsert: true, new: true }
    );

    return res.json({ entry, game });
  } catch (e) {
    if (String(e?.code) === "11000") {
      return res.status(409).json({ message: "Game already in your list" });
    }
    console.error(e);
    res.status(500).json({ message: "Failed to add game" });
  }
});

// GET /api/library/entry/:igdbId
router.get("/entry/:igdbId", requireAuth, async (req, res) => {
  try {
    const igdbId = Number(req.params.igdbId);
    if (!Number.isFinite(igdbId)) return res.status(400).json({ message: "Invalid igdbId" });

    const game = await Game.findOne({ igdbId });
    if (!game) return res.json({ entry: null });

    const entry = await UserGameEntry.findOne({ userId: req.userId, gameId: game._id });
    return res.json({ entry: entry || null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to fetch entry" });
  }
});

/**
 * PATCH /api/library/:igdbId
 * body can include: { status?, rating?, isFavorite? }
 */
router.patch("/:igdbId", requireAuth, async (req, res) => {
  try {
    const igdbId = Number(req.params.igdbId);
    if (!Number.isFinite(igdbId)) {
      return res.status(400).json({ message: "Invalid igdbId" });
    }

    const game = await Game.findOne({ igdbId });
    if (!game) {
      return res.status(404).json({ message: "Game not in DB yet. Add it first." });
    }

    const entry = await UserGameEntry.findOne({ userId: req.userId, gameId: game._id });
    if (!entry) {
      return res.status(404).json({ message: "Game not in your list" });
    }

    if (req.body.status !== undefined) {
      if (!isValidStatus(req.body.status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      entry.status = req.body.status;
    }

    if (req.body.rating !== undefined || req.body.rating === null) {
      const ratingResult = parseValidatedRating(req.body.rating);

      if (!ratingResult.ok) {
        return res.status(400).json({ message: ratingResult.message });
      }

      if (ratingResult.value !== undefined) {
        entry.rating = ratingResult.value;
      }
    }

    if (req.body.isFavorite !== undefined) {
      if (typeof req.body.isFavorite !== "boolean") {
        return res.status(400).json({ message: "isFavorite must be a boolean" });
      }

      const nextFav = req.body.isFavorite;

      if (nextFav && !entry.isFavorite) {
        entry.isFavorite = true;
        entry.favoriteAddedAt = new Date();
      }

      if (!nextFav) {
        entry.isFavorite = false;
        entry.favoriteAddedAt = null;
      }
    }

    await entry.save();

    return res.json({ entry });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to update entry" });
  }
});

/**
 * GET /api/library/me
 */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const items = await UserGameEntry.find({ userId: req.userId })
      .sort({ updatedAt: -1 })
      .populate("gameId");

    const out = items.map(it => ({
      id: it._id,
      status: it.status,
      rating: it.rating,
      playtimeHours: it.playtimeHours,
      notes: it.notes,
      createdAt: it.createdAt,
      updatedAt: it.updatedAt,
      isFavorite: !!it.isFavorite,
      favoriteAddedAt: it.favoriteAddedAt ?? null,
      game: it.gameId ? {
        igdbId: it.gameId.igdbId,
        name: it.gameId.name,
        coverImageId: it.gameId.coverImageId,
        firstReleaseDate: it.gameId.firstReleaseDate,
        metacriticRating: it.gameId.metacriticRating,
      } : null
    }));

    res.json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to fetch library" });
  }
});

// GET /api/library/profile/:username
router.get("/profile/:username", requireAuth, async (req, res) => {
  try {
    const usernameResult = parseUsername(req.params.username);
    if (!usernameResult.ok) {
      return res.status(400).json({ message: usernameResult.message });
    }

    const user = await User.findOne({ username: usernameResult.normalizedValue })
      .select("_id username displayUsername");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const items = await UserGameEntry.find({ userId: user._id })
      .sort({ updatedAt: -1 })
      .populate("gameId");

    const out = items.map(it => ({
      id: it._id,
      status: it.status,
      rating: it.rating,
      playtimeHours: it.playtimeHours,
      notes: it.notes,
      createdAt: it.createdAt,
      updatedAt: it.updatedAt,
      isFavorite: !!it.isFavorite,
      favoriteAddedAt: it.favoriteAddedAt ?? null,
      game: it.gameId ? {
        igdbId: it.gameId.igdbId,
        name: it.gameId.name,
        coverImageId: it.gameId.coverImageId,
        firstReleaseDate: it.gameId.firstReleaseDate,
        metacriticRating: it.gameId.metacriticRating,
      } : null
    }));

    res.json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to fetch profile library" });
  }
});

// DELETE /api/library/:igdbId
router.delete("/:igdbId", requireAuth, async (req, res) => {
  try {
    const igdbId = Number(req.params.igdbId);
    if (!Number.isFinite(igdbId)) return res.status(400).json({ message: "Invalid igdbId" });

    const game = await Game.findOne({ igdbId });
    if (!game) return res.json({ removed: false });

    const result = await UserGameEntry.deleteOne({ userId: req.userId, gameId: game._id });

    return res.json({ removed: result.deletedCount > 0 });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to remove entry" });
  }
});

export default router;