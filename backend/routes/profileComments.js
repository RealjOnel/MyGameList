import express from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { User } from "../models/user.js";
import { ProfileComment } from "../models/profileComment.js";

const router = express.Router();

const MAX_COMMENT_LENGTH = 100;
const MAX_COMMENTS_PER_AUTHOR_PER_PROFILE = 10;
const COMMENT_COOLDOWN_MS = 30 * 1000;

// GET /api/profile-comments/:username
router.get("/:username", async (req, res) => {
  try {
    const username = String(req.params.username || "").trim();
    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    const profileUser = await User.findOne({ username }).select("_id username");
    if (!profileUser) {
      return res.status(404).json({ message: "Profile user not found" });
    }

    const comments = await ProfileComment.find({ profileUserId: profileUser._id })
      .sort({ createdAt: -1 })
      .populate("authorUserId", "username")
      .limit(100);

    const out = comments.map((comment) => ({
      id: comment._id,
      text: comment.text,
      createdAt: comment.createdAt,
      canDelete: false, // will be determined on client side based on current user
      author: {
        username: comment.authorUserId?.username || "Unknown User",
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
router.post("/:username", requireAuth, async (req, res) => {
  try {
    const username = String(req.params.username || "").trim();
    const text = String(req.body?.text || "").trim();

    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    if (!text) {
      return res.status(400).json({ message: "Comment cannot be empty" });
    }

    if (text.length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({
        message: `Comment must be ${MAX_COMMENT_LENGTH} characters or less`,
      });
    }

    const profileUser = await User.findOne({ username }).select("_id username");
    if (!profileUser) {
      return res.status(404).json({ message: "Profile user not found" });
    }

    const authorUser = await User.findById(req.userId).select("_id username");
    if (!authorUser) {
      return res.status(404).json({ message: "Author user not found" });
    }

    // owner of the profile cannot comment on own profile
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
      text,
    });

    res.status(201).json({
      comment: {
        id: created._id,
        text: created.text,
        createdAt: created.createdAt,
        canDelete: true,
        author: {
          username: authorUser.username,
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
    const commentId = String(req.params.commentId || "").trim();
    if (!commentId) {
      return res.status(400).json({ message: "Comment id is required" });
    }

    const comment = await ProfileComment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    if (String(comment.authorUserId) !== String(req.userId)) {
      return res.status(403).json({ message: "You can only delete your own comments" });
    }

    await ProfileComment.deleteOne({ _id: comment._id });

    res.json({ deleted: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to delete comment" });
  }
});

export default router;