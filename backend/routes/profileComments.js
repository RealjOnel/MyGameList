import express from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { User } from "../models/user.js";
import { ProfileComment } from "../models/profileComment.js";

const router = express.Router();

const DEFAULT_USER_ICON = "../assets/User/Default_User_Icon.png";

// GET /api/profile-comments/:username
router.get("/:username", async (req, res) => {
  try {
    const username = String(req.params.username || "").trim();
    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    const profileUser = await User.findOne({ username }).select("_id username");
    if (!profileUser) {
      return res.status(404).json({ message: "Profile not found" });
    }

    const comments = await ProfileComment.find({ profileUserId: profileUser._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("authorUserId", "username");

    const out = comments.map((c) => ({
      id: c._id,
      text: c.text,
      createdAt: c.createdAt,
      author: {
        id: c.authorUserId?._id || null,
        username: c.authorUserId?.username || "Unknown User",
        avatarUrl: DEFAULT_USER_ICON,
      },
    }));

    res.json({
      profileUsername: profileUser.username,
      comments: out,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to load comments" });
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

    if (text.length > 100) {
      return res.status(400).json({ message: "Comment must be 100 characters or less" });
    }

    const profileUser = await User.findOne({ username }).select("_id username");
    if (!profileUser) {
      return res.status(404).json({ message: "Profile not found" });
    }

    const authorUser = await User.findById(req.userId).select("_id username");
    if (!authorUser) {
      return res.status(404).json({ message: "Author not found" });
    }

    const comment = await ProfileComment.create({
      profileUserId: profileUser._id,
      authorUserId: authorUser._id,
      text,
    });

    res.status(201).json({
      comment: {
        id: comment._id,
        text: comment.text,
        createdAt: comment.createdAt,
        author: {
          id: authorUser._id,
          username: authorUser.username,
          avatarUrl: DEFAULT_USER_ICON,
        },
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to post comment" });
  }
});

export default router;