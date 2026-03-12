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

// GET /api/users/profile/:username
router.get("/profile/:username", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");

    const username = String(req.params.username || "").trim();
    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    const user = await User.findOne({ username }).select("username createdAt lastLoginAt");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      id: user._id,
      username: user.username,
      createdAt: user.createdAt ?? user._id.getTimestamp(),
      lastLoginAt: user.lastLoginAt ?? null
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to load profile" });
  }
});

export default router;