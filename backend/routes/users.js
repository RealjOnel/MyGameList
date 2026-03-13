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

    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const users = await User.find({
      username: { $regex: safe, $options: "i" }
    })
      .select("username")
      .sort({ username: 1 })
      .limit(8);

    res.json({
      users: users.map((user) => ({
        id: user._id,
        username: user.username,
        avatarUrl: null
      }))
    });
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