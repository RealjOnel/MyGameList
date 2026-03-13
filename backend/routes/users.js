import express from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { User } from "../models/user.js";

const router = express.Router();

// GET /api/users/me
router.get("/me", requireAuth, async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const user = await User.findById(req.userId).select("username createdAt lastLoginAt");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      id: user._id,
      username: user.username,
      createdAt: user.createdAt ?? user._id.getTimestamp(),
      lastLoginAt: user.lastLoginAt ?? null
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to load user" });
  }
});

function escapeRegex(str = "") {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// GET /api/users/search?q=...
router.get("/search", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");

    const q = String(req.query.q || "").trim();
    if (!q) {
      return res.json({ users: [] });
    }

    const safe = escapeRegex(q);

    const users = await User.find({
      username: { $regex: safe, $options: "i" }
    })
      .select("username")
      .limit(20);

    const qLower = q.toLowerCase();

    const scored = users
      .map((user) => {
        const name = String(user.username || "");
        const lower = name.toLowerCase();

        let score = 99;
        if (lower === qLower) score = 0;
        else if (lower.startsWith(qLower)) score = 1;
        else if (lower.includes(qLower)) score = 2;

        return {
          id: user._id,
          username: user.username,
          avatarUrl: null,
          score,
        };
      })
      .sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score;
        return a.username.localeCompare(b.username);
      })
      .slice(0, 8);

    res.json({ users: scored });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to search users" });
  }
});

// GET /api/users/profile/:username
router.get("/profile/:username", requireAuth, async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");

    const username = String(req.params.username || "").trim();
    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    const user = await User.findOne({ username }).select("username createdAt lastLoginAt");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      id: user._id,
      username: user.username,
      createdAt: user.createdAt ?? user._id.getTimestamp(),
      lastLoginAt: user.lastLoginAt ?? null
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to load profile user" });
  }
});

export default router;