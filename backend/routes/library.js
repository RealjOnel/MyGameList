import express from "express";
import axios from "axios";
import { requireAuth } from "../middleware/authMiddleware.js";
import { getTwitchToken } from "../services/twitchToken.js";
import { Game } from "../models/game.js";
import { UserGameEntry } from "../models/userGameEntry.js";

const router = express.Router();

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

    if (!Number.isFinite(igdbId)) return res.status(400).json({ message: "Invalid igdbId" });

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
    // duplicate key -> already in list
    if (String(e?.code) === "11000") {
      return res.status(409).json({ message: "Game already in your list" });
    }
    console.error(e);
    res.status(500).json({ message: "Failed to add game" });
  }
});

// GET /api/library/entry/:igdbId
// returns the user's entry for this game (or null)
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
 * body can include: { status?, rating? }
 */
router.patch("/:igdbId", requireAuth, async (req, res) => {
  try {
    const igdbId = Number(req.params.igdbId);
    if (!Number.isFinite(igdbId)) return res.status(400).json({ message: "Invalid igdbId" });

    const game = await Game.findOne({ igdbId });
    if (!game) return res.status(404).json({ message: "Game not in DB yet. Add it first." });

    const update = {};
    if (typeof req.body.status === "string") update.status = req.body.status;
    if (req.body.rating === null) {
      update.rating = null;
    } else if (req.body.rating !== undefined) {
      const n = Number(req.body.rating);
      if (Number.isFinite(n)) update.rating = n;
    }

    const entry = await UserGameEntry.findOneAndUpdate(
      { userId: req.userId, gameId: game._id },
      { $set: update },
      { new: true }
    );

    if (!entry) return res.status(404).json({ message: "Game not in your list" });

    return res.json({ entry });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to update entry" });
  }
});

/**
 * GET /api/library/me
 * returns user's list with populated game data
 */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const items = await UserGameEntry.find({ userId: req.userId })
      .sort({ updatedAt: -1 })
      .populate("gameId");

    // normalize response: { entry fields + game fields }
    const out = items.map(it => ({
      id: it._id,
      status: it.status,
      rating: it.rating,
      playtimeHours: it.playtimeHours,
      notes: it.notes,
      createdAt: it.createdAt,
      updatedAt: it.updatedAt,
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

// DELETE /api/library/:igdbId  -> remove game from user's list
router.delete("/:igdbId", requireAuth, async (req, res) => {
  try {
    const igdbId = Number(req.params.igdbId);
    if (!Number.isFinite(igdbId)) return res.status(400).json({ message: "Invalid igdbId" });

    const game = await Game.findOne({ igdbId });
    if (!game) return res.json({ removed: false }); // nothing to remove

    const result = await UserGameEntry.deleteOne({ userId: req.userId, gameId: game._id });

    return res.json({ removed: result.deletedCount > 0 });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to remove entry" });
  }
});

export default router;