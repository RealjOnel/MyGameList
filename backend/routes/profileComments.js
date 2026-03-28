import express from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { requireAuth } from "../middleware/authMiddleware.js";
import { User } from "../models/user.js";
import { ProfileComment } from "../models/profileComment.js";
import { postCommentLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

const MAX_COMMENT_LENGTH = 100;
const MAX_COMMENTS_PER_AUTHOR_PER_PROFILE = 10;
const COMMENT_COOLDOWN_MS = 30 * 1000;

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username is required")
  .max(20, "Username is too long");

const commentTextSchema = z
  .string()
  .trim()
  .min(1, "Comment cannot be empty")
  .max(MAX_COMMENT_LENGTH, `Comment must be ${MAX_COMMENT_LENGTH} characters or less`);

function normalizeUsername(rawValue = "") {
  return String(rawValue || "").trim().toLowerCase();
}

function getPublicUsername(user) {
  return user?.displayUsername || user?.username || "Unknown User";
}

function parseUsername(value) {
  const parsed = usernameSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message || "Invalid username" };
  }

  return {
    ok: true,
    value: parsed.data,
    normalizedValue: normalizeUsername(parsed.data)
  };
}

function parseCommentText(value) {
  const parsed = commentTextSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message || "Invalid comment text" };
  }
  return { ok: true, value: parsed.data };
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

// GET /api/profile-comments/:username
router.get("/:username", async (req, res) => {
  try {
    const usernameResult = parseUsername(req.params.username);
    if (!usernameResult.ok) {
      return res.status(400).json({ message: usernameResult.message });
    }

    const profileUser = await User.findOne({ username: usernameResult.normalizedValue })
      .select("_id username displayUsername");

    if (!profileUser) {
      return res.status(404).json({ message: "Profile user not found" });
    }

    const comments = await ProfileComment.find({ profileUserId: profileUser._id })
      .sort({ createdAt: -1 })
      .populate("authorUserId", "username displayUsername")
      .limit(100);

    const out = comments.map((comment) => ({
      id: comment._id,
      text: comment.text,
      createdAt: comment.createdAt,
      canDelete: false,
      author: {
        username: getPublicUsername(comment.authorUserId),
        avatarUrl: null,
      },
    }));

    res.json({ comments: out });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to load profile comments" });
  }
});

// POST /api/profile-comments/:username
router.post("/:username", requireAuth, postCommentLimiter, async (req, res) => {
  try {
    const usernameResult = parseUsername(req.params.username);
    if (!usernameResult.ok) {
      return res.status(400).json({ message: usernameResult.message });
    }

    const textResult = parseCommentText(req.body?.text);
    if (!textResult.ok) {
      return res.status(400).json({ message: textResult.message });
    }

    const profileUser = await User.findOne({ username: usernameResult.normalizedValue })
      .select("_id username displayUsername");

    if (!profileUser) {
      return res.status(404).json({ message: "Profile user not found" });
    }

    const authorUser = await User.findById(req.userId).select("_id username displayUsername");
    if (!authorUser) {
      return res.status(404).json({ message: "Author user not found" });
    }

    if (String(profileUser._id) === String(authorUser._id)) {
      return res.status(400).json({ message: "You cannot comment on your own profile" });
    }

    const existingCount = await ProfileComment.countDocuments({
      profileUserId: profileUser._id,
      authorUserId: authorUser._id,
    });

    if (existingCount >= MAX_COMMENTS_PER_AUTHOR_PER_PROFILE) {
      return res.status(400).json({
        message: `You can only post ${MAX_COMMENTS_PER_AUTHOR_PER_PROFILE} comments on this profile`,
      });
    }

    const latestOwnComment = await ProfileComment.findOne({
      profileUserId: profileUser._id,
      authorUserId: authorUser._id,
    }).sort({ createdAt: -1 });

    if (latestOwnComment) {
      const diff = Date.now() - new Date(latestOwnComment.createdAt).getTime();
      if (diff < COMMENT_COOLDOWN_MS) {
        const waitSeconds = Math.ceil((COMMENT_COOLDOWN_MS - diff) / 1000);
        return res.status(400).json({
          message: `Please wait ${waitSeconds} seconds before posting another comment`,
        });
      }
    }

    const created = await ProfileComment.create({
      profileUserId: profileUser._id,
      authorUserId: authorUser._id,
      text: textResult.value,
    });

    res.status(201).json({
      comment: {
        id: created._id,
        text: created.text,
        createdAt: created.createdAt,
        canDelete: true,
        author: {
          username: getPublicUsername(authorUser),
          avatarUrl: null,
        },
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to post profile comment" });
  }
});

// DELETE /api/profile-comments/comment/:commentId
router.delete("/comment/:commentId", requireAuth, async (req, res) => {
  try {
    const commentIdResult = parseObjectId(req.params.commentId, "Comment id");
    if (!commentIdResult.ok) {
      return res.status(400).json({ message: commentIdResult.message });
    }

    const comment = await ProfileComment.findById(commentIdResult.value);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const isAuthor = String(comment.authorUserId) === String(req.userId);
    const isProfileOwner = String(comment.profileUserId) === String(req.userId);

    if (!isAuthor && !isProfileOwner) {
      return res.status(403).json({
        message: "You can only delete your own comments or comments on your own profile",
      });
    }

    await ProfileComment.deleteOne({ _id: comment._id });

    res.json({ deleted: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to delete comment" });
  }
});

export default router;