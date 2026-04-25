import express from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { requireAuth } from "../middleware/authMiddleware.js";
import { Game } from "../models/game.js";
import { User } from "../models/user.js";
import { UserGameEntry } from "../models/userGameEntry.js";
import { Review } from "../models/review.js";
import { ReviewReaction } from "../models/reviewReaction.js";
import { sanitizeReviewHtml } from "../utils/sanitizeReviewHtml.js";
import jwt from "jsonwebtoken";
import { env } from "../config/validateEnv.js";
import { reviewWriteLimiter, reviewReactionLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

const REVIEW_RECOMMENDATIONS = ["recommended", "mixed", "not"];
const ALLOWED_REVIEW_REACTIONS = ["👍", "❤️", "😂", "😮", "😭", "💀", "🌹"];

const DEFAULT_SETTINGS = Object.freeze({
  social: {
    showReviews: true
  },
  privacy: {
    publicProfile: true
  }
});

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username is required")
  .max(20, "Username is too long");

const igdbIdSchema = z.coerce.number().int().positive("Invalid igdbId");

const reviewBodySchema = z.object({
  recommendation: z.enum(REVIEW_RECOMMENDATIONS),
  html: z.string().max(50000, "Review is too large")
}).strict();

const reactionBodySchema = z.object({
  emoji: z.enum(ALLOWED_REVIEW_REACTIONS)
}).strict();

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function deepMerge(target, source) {
  const out = { ...target };

  for (const [key, value] of Object.entries(source || {})) {
    if (isPlainObject(value) && isPlainObject(out[key])) {
      out[key] = deepMerge(out[key], value);
    } else {
      out[key] = value;
    }
  }

  return out;
}

function normalizeSettings(settings) {
  const raw = settings?.toObject ? settings.toObject() : settings || {};
  return deepMerge(cloneDefaults(), raw);
}

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

function parseIgdbId(value) {
  const parsed = igdbIdSchema.safeParse(value);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message || "Invalid igdbId"
    };
  }

  return {
    ok: true,
    value: parsed.data
  };
}

function parseObjectId(value, fieldName = "Id") {
  const raw = String(value || "").trim();

  if (!raw) {
    return { ok: false, message: `${fieldName} is required` };
  }

  if (!mongoose.Types.ObjectId.isValid(raw)) {
    return { ok: false, message: `Invalid ${fieldName.toLowerCase()}` };
  }

  return { ok: true, value: raw };
}

function parseRecommendationFilter(value) {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: undefined };
  }

  const raw = String(value).trim().toLowerCase();
  if (!REVIEW_RECOMMENDATIONS.includes(raw)) {
    return { ok: false, message: "Invalid recommendation filter" };
  }

  return { ok: true, value: raw };
}

function parseRatingFilter(value) {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: undefined };
  }

  const n = Number(value);

  if (!Number.isInteger(n) || n < 1 || n > 10) {
    return { ok: false, message: "Invalid rating filter" };
  }

  return { ok: true, value: n };
}

function parsePage(value) {
  const n = Number(value ?? 1);
  if (!Number.isInteger(n) || n < 1) return 1;
  return n;
}

function parseLimit(value, fallback = 10, max = 50) {
  const n = Number(value ?? fallback);
  if (!Number.isInteger(n) || n < 1) return fallback;
  return Math.min(n, max);
}

function sameId(a, b) {
  return String(a) === String(b);
}

function hasFriend(user, targetUserId) {
  return Array.isArray(user?.friends) && user.friends.some((id) => sameId(id, targetUserId));
}

function canViewProfile(viewer, targetUser) {
  if (!targetUser) return false;

  const settings = normalizeSettings(targetUser.settings);

  if (!viewer) {
    return settings.privacy.publicProfile !== false;
  }

  if (sameId(viewer._id, targetUser._id)) return true;
  if (hasFriend(viewer, targetUser._id)) return true;

  return settings.privacy.publicProfile !== false;
}

function getPublicUsername(user) {
  return user?.displayUsername || user?.username || "";
}

async function getGameByIgdbId(igdbId) {
  return Game.findOne({ igdbId });
}

function getOptionalViewerId(req) {
  const authHeader = String(req.headers?.authorization || "").trim();
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);

    const rawUserId = payload?.id || payload?.userId;

    if (!rawUserId) {
      return null;
    }

    const viewerId = String(rawUserId);

    if (!mongoose.Types.ObjectId.isValid(viewerId)) {
      return null;
    }

    return viewerId;
  } catch {
    return null;
  }
}

async function buildReactionState(reviewIds, viewerId = null) {
  const state = new Map();

  if (!reviewIds.length) return state;

  const docs = await ReviewReaction.find({
    reviewId: { $in: reviewIds }
  }).select("reviewId emoji userId");

  for (const doc of docs) {
    const key = String(doc.reviewId);

    if (!state.has(key)) {
      state.set(key, {
        reactionCounts: {},
        viewerReactions: []
      });
    }

    const target = state.get(key);
    target.reactionCounts[doc.emoji] = (target.reactionCounts[doc.emoji] || 0) + 1;

    if (viewerId && sameId(doc.userId, viewerId) && !target.viewerReactions.includes(doc.emoji)) {
      target.viewerReactions.push(doc.emoji);
    }
  }

  return state;
}

function serializeReview({
  review,
  author,
  game,
  rating,
  reactionState,
  isOwner = false
}) {
  return {
    id: review._id,
    recommendation: review.recommendation,
    html: review.html,
    plainText: review.plainText,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    isOwner,
    rating: rating ?? null,
    author: author
      ? {
          id: author._id,
          username: getPublicUsername(author),
          avatarUrl: author?.avatarUrl ?? null
        }
      : null,
    game: game
      ? {
          id: game._id,
          igdbId: game.igdbId,
          name: game.name,
          coverImageId: game.coverImageId
        }
      : null,
    reactionCounts: reactionState?.reactionCounts || {},
    viewerReactions: reactionState?.viewerReactions || []
  };
}

// GET own review for one game
router.get("/game/:igdbId/me", requireAuth, async (req, res) => {
  try {
    const igdbIdResult = parseIgdbId(req.params.igdbId);
    if (!igdbIdResult.ok) {
      return res.status(400).json({ message: igdbIdResult.message });
    }

    const game = await getGameByIgdbId(igdbIdResult.value);
    if (!game) {
      return res.json({ review: null, entry: null });
    }

    const entry = await UserGameEntry.findOne({
      userId: req.userId,
      gameId: game._id
    });

    if (!entry) {
      return res.status(403).json({
        message: "You can only review games that are in your library"
      });
    }

    const review = await Review.findOne({
      userId: req.userId,
      gameId: game._id
    });

    if (!review) {
      return res.json({
        review: null,
        entry: {
          status: entry.status,
          rating: entry.rating
        }
      });
    }

    const me = await User.findById(req.userId).select("username displayUsername avatarUrl")
    const reactionStateMap = await buildReactionState([review._id], req.userId);

    return res.json({
      review: serializeReview({
        review,
        author: me,
        game,
        rating: entry.rating,
        reactionState: reactionStateMap.get(String(review._id)),
        isOwner: true
      }),
      entry: {
        status: entry.status,
        rating: entry.rating
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to load your review" });
  }
});

// GET reviews for one game
router.get("/game/:igdbId", async (req, res) => {
  try {
    const igdbIdResult = parseIgdbId(req.params.igdbId);
    if (!igdbIdResult.ok) {
      return res.status(400).json({ message: igdbIdResult.message });
    }

    const recommendationResult = parseRecommendationFilter(req.query.recommendation);
    if (!recommendationResult.ok) {
      return res.status(400).json({ message: recommendationResult.message });
    }

    const ratingResult = parseRatingFilter(req.query.rating);
    if (!ratingResult.ok) {
      return res.status(400).json({ message: ratingResult.message });
    }

    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit, 10, 50);

    const viewerId = getOptionalViewerId(req);

    const game = await getGameByIgdbId(igdbIdResult.value);
    if (!game) {
      return res.json({
        reviews: [],
        pagination: {
          page,
          limit,
          total: 0,
          hasMore: false
        }
      });
    }

    const reviewMatch = { gameId: game._id };

    if (recommendationResult.value) {
      reviewMatch.recommendation = recommendationResult.value;
    }

    let userIdFilter = null;

    if (ratingResult.value !== undefined) {
      const matchingEntries = await UserGameEntry.find({
        gameId: game._id,
        rating: ratingResult.value
      }).select("userId");

      let matchingUserIds = matchingEntries.map((entry) => String(entry.userId));

      if (viewerId) {
        matchingUserIds = matchingUserIds.filter((id) => !sameId(id, viewerId));
      }

      if (!matchingUserIds.length) {
        return res.json({
          reviews: [],
          pagination: {
            page,
            limit,
            total: 0,
            hasMore: false
          }
        });
      }

      userIdFilter = { $in: matchingUserIds };
    } else if (viewerId) {
      userIdFilter = { $ne: viewerId };
    }

    if (userIdFilter) {
      reviewMatch.userId = userIdFilter;
    }

    const total = await Review.countDocuments(reviewMatch);

    const reviews = await Review.find(reviewMatch)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    if (!reviews.length) {
      return res.json({
        reviews: [],
        pagination: {
          page,
          limit,
          total,
          hasMore: false
        }
      });
    }

    const userIds = [...new Set(reviews.map((review) => String(review.userId)))];
    const reviewIds = reviews.map((review) => review._id);

    const [authors, entries, reactionStateMap] = await Promise.all([
      User.find({ _id: { $in: userIds } }).select("username displayUsername avatarUrl"),
      UserGameEntry.find({
        gameId: game._id,
        userId: { $in: userIds }
      }).select("userId rating"),
      buildReactionState(reviewIds, viewerId)
    ]);

    const authorById = new Map(authors.map((user) => [String(user._id), user]));
    const ratingByUserId = new Map(entries.map((entry) => [String(entry.userId), entry.rating]));

    return res.json({
      reviews: reviews.map((review) =>
        serializeReview({
          review,
          author: authorById.get(String(review.userId)),
          game,
          rating: ratingByUserId.get(String(review.userId)) ?? null,
          reactionState: reactionStateMap.get(String(review._id)),
          isOwner: viewerId ? sameId(review.userId, viewerId) : false
        })
      ),
      pagination: {
        page,
        limit,
        total,
        hasMore: page * limit < total
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to load game reviews" });
  }
});

// GET reviews for one profile
router.get("/profile/:username", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");

    const usernameResult = parseUsername(req.params.username);
    if (!usernameResult.ok) {
      return res.status(400).json({ message: usernameResult.message });
    }

    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit, 6, 50);

    const viewerId = getOptionalViewerId(req);

    const [viewer, targetUser] = await Promise.all([
      viewerId
        ? User.findById(viewerId).select("_id username displayUsername friends")
        : null,
      User.findOne({ username: usernameResult.normalizedValue })
        .select("_id username displayUsername avatarUrl settings friends")
    ]);

    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const settings = normalizeSettings(targetUser.settings);
    const isOwner = viewer ? sameId(viewer._id, targetUser._id) : false;

    if (!canViewProfile(viewer, targetUser)) {
      return res.status(403).json({ message: "This profile is private" });
    }

    if (!isOwner && settings.social.showReviews === false) {
      return res.status(403).json({ message: "This user has hidden their reviews" });
    }

    const total = await Review.countDocuments({ userId: targetUser._id });

    const reviews = await Review.find({ userId: targetUser._id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    if (!reviews.length) {
      return res.json({
        reviews: [],
        pagination: {
          page,
          limit,
          total,
          hasMore: false
        }
      });
    }

    const gameIds = [...new Set(reviews.map((review) => String(review.gameId)))];
    const reviewIds = reviews.map((review) => review._id);

    const [games, entries, reactionStateMap] = await Promise.all([
      Game.find({ _id: { $in: gameIds } }).select("igdbId name coverImageId"),
      UserGameEntry.find({
        userId: targetUser._id,
        gameId: { $in: gameIds }
      }).select("gameId rating"),
      buildReactionState(reviewIds, viewerId)
    ]);

    const gameById = new Map(games.map((game) => [String(game._id), game]));
    const ratingByGameId = new Map(entries.map((entry) => [String(entry.gameId), entry.rating]));

    return res.json({
      reviews: reviews.map((review) =>
        serializeReview({
          review,
          author: targetUser,
          game: gameById.get(String(review.gameId)),
          rating: ratingByGameId.get(String(review.gameId)) ?? null,
          reactionState: reactionStateMap.get(String(review._id)),
          isOwner
        })
      ),
      pagination: {
        page,
        limit,
        total,
        hasMore: page * limit < total
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to load profile reviews" });
  }
});

// GET one review for modal/detail
router.get("/:reviewId", async (req, res) => {
  try {
    const reviewIdResult = parseObjectId(req.params.reviewId, "Review id");
    if (!reviewIdResult.ok) {
      return res.status(400).json({ message: reviewIdResult.message });
    }

    const review = await Review.findById(reviewIdResult.value);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    const [author, game, entry, reactionStateMap] = await Promise.all([
      User.findById(review.userId).select("username displayUsername avatarUrl"),
      Game.findById(review.gameId).select("igdbId name coverImageId"),
      UserGameEntry.findOne({
        userId: review.userId,
        gameId: review.gameId
      }).select("rating"),
      buildReactionState([review._id])
    ]);

    return res.json({
      review: serializeReview({
        review,
        author,
        game,
        rating: entry?.rating ?? null,
        reactionState: reactionStateMap.get(String(review._id)),
        isOwner: false
      })
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to load review" });
  }
});

// CREATE or UPDATE own review for game
router.put("/game/:igdbId", requireAuth, reviewWriteLimiter, async (req, res) => {
  try {
    const igdbIdResult = parseIgdbId(req.params.igdbId);
    if (!igdbIdResult.ok) {
      return res.status(400).json({ message: igdbIdResult.message });
    }

    const parsedBody = reviewBodySchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({
        message: parsedBody.error.issues[0]?.message || "Invalid review payload"
      });
    }

    const game = await getGameByIgdbId(igdbIdResult.value);
    if (!game) {
      return res.status(404).json({ message: "Game not found in DB yet. Add it first." });
    }

    const entry = await UserGameEntry.findOne({
      userId: req.userId,
      gameId: game._id
    }).select("userId gameId rating status");

    if (!entry) {
      return res.status(403).json({
        message: "You can only review games that are in your library"
      });
    }

    const sanitized = sanitizeReviewHtml(parsedBody.data.html);

    if (!sanitized.plainText) {
      return res.status(400).json({ message: "Review cannot be empty" });
    }

    if (sanitized.plainText.length > 3000) {
      return res.status(400).json({ message: "Review must be 3000 characters or less" });
    }

    const review = await Review.findOneAndUpdate(
      {
        userId: req.userId,
        gameId: game._id
      },
      {
        $set: {
          recommendation: parsedBody.data.recommendation,
          html: sanitized.html,
          plainText: sanitized.plainText
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    const me = await User.findById(req.userId).select("username displayUsername");
    const reactionStateMap = await buildReactionState([review._id], req.userId);

    return res.json({
      review: serializeReview({
        review,
        author: me,
        game,
        rating: entry.rating ?? null,
        reactionState: reactionStateMap.get(String(review._id)),
        isOwner: true
      })
    });
  } catch (e) {
    if (String(e?.code) === "11000") {
      return res.status(409).json({ message: "You already have a review for this game" });
    }

    console.error(e);
    res.status(500).json({ message: "Failed to save review" });
  }
});

// DELETE own review for game
router.delete("/game/:igdbId", requireAuth, reviewWriteLimiter, async (req, res) => {
  try {
    const igdbIdResult = parseIgdbId(req.params.igdbId);
    if (!igdbIdResult.ok) {
      return res.status(400).json({ message: igdbIdResult.message });
    }

    const game = await getGameByIgdbId(igdbIdResult.value);
    if (!game) {
      return res.json({ removed: false });
    }

    const review = await Review.findOne({
      userId: req.userId,
      gameId: game._id
    });

    if (!review) {
      return res.json({ removed: false });
    }

    await Promise.all([
      ReviewReaction.deleteMany({ reviewId: review._id }),
      Review.deleteOne({ _id: review._id })
    ]);

    return res.json({ removed: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to delete review" });
  }
});

// ADD reaction
router.post("/:reviewId/reactions", requireAuth, reviewReactionLimiter, async (req, res) => {
  try {
    const reviewIdResult = parseObjectId(req.params.reviewId, "Review id");
    if (!reviewIdResult.ok) {
      return res.status(400).json({ message: reviewIdResult.message });
    }

    const parsedBody = reactionBodySchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({
        message: parsedBody.error.issues[0]?.message || "Invalid reaction payload"
      });
    }

    const review = await Review.findById(reviewIdResult.value).select("_id");
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    await ReviewReaction.updateOne(
      {
        reviewId: review._id,
        userId: req.userId,
        emoji: parsedBody.data.emoji
      },
      {
        $setOnInsert: {
          reviewId: review._id,
          userId: req.userId,
          emoji: parsedBody.data.emoji
        }
      },
      {
        upsert: true
      }
    );

    const reactionStateMap = await buildReactionState([review._id], req.userId);

    return res.json({
      reviewId: review._id,
      reactionCounts: reactionStateMap.get(String(review._id))?.reactionCounts || {},
      viewerReactions: reactionStateMap.get(String(review._id))?.viewerReactions || []
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to add reaction" });
  }
});

// REMOVE reaction
router.delete("/:reviewId/reactions/:emoji", requireAuth, reviewReactionLimiter, async (req, res) => {
  try {
    const reviewIdResult = parseObjectId(req.params.reviewId, "Review id");
    if (!reviewIdResult.ok) {
      return res.status(400).json({ message: reviewIdResult.message });
    }

    const emoji = decodeURIComponent(String(req.params.emoji || "").trim());

    if (!ALLOWED_REVIEW_REACTIONS.includes(emoji)) {
      return res.status(400).json({ message: "Invalid reaction emoji" });
    }

    const review = await Review.findById(reviewIdResult.value).select("_id");
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    await ReviewReaction.deleteOne({
      reviewId: review._id,
      userId: req.userId,
      emoji
    });

    const reactionStateMap = await buildReactionState([review._id], req.userId);

    return res.json({
      reviewId: review._id,
      reactionCounts: reactionStateMap.get(String(review._id))?.reactionCounts || {},
      viewerReactions: reactionStateMap.get(String(review._id))?.viewerReactions || []
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to remove reaction" });
  }
});

export default router;