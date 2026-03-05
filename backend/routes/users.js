import express from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { User } from "../models/user.js";

const router = express.Router();

// GET /api/users/me
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("username createdAt"); 
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      id: user._id,
      username: user.username,
      createdAt: user.createdAt
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to load user" });
  }
});

export default router;