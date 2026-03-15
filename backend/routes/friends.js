import express from "express";
import mongoose from "mongoose";
import { requireAuth } from "../middleware/authMiddleware.js";
import { User } from "../models/user.js";
import { FriendRequest } from "../models/friendRequest.js";

const router = express.Router();

function sameId(a, b) {
  return String(a) === String(b);
}

function hasFriend(user, targetUserId) {
  return Array.isArray(user?.friends) && user.friends.some((id) => sameId(id, targetUserId));
}

function normalizeFriendUser(user) {
  return {
    id: user._id,
    username: user.username,
    avatarUrl: null, // later real avatar url when implemented
    createdAt: user.createdAt ?? null,
    lastLoginAt: user.lastLoginAt ?? null,
  };
}

// GET /api/friends/status/:username
router.get("/status/:username", requireAuth, async (req, res) => {
  try {
    const username = String(req.params.username || "").trim();
    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    const viewer = await User.findById(req.userId).select("_id username friends");
    if (!viewer) {
      return res.status(404).json({ message: "Viewer not found" });
    }

    const target = await User.findOne({ username }).select("_id username");
    if (!target) {
      return res.status(404).json({ message: "Target user not found" });
    }

    if (sameId(viewer._id, target._id)) {
      return res.json({ status: "self" });
    }

    if (hasFriend(viewer, target._id)) {
      return res.json({ status: "friends" });
    }

    const outgoing = await FriendRequest.findOne({
      fromUserId: viewer._id,
      toUserId: target._id,
      status: "pending",
    }).select("_id createdAt");

    if (outgoing) {
      return res.json({
        status: "outgoing_request",
        requestId: outgoing._id,
        createdAt: outgoing.createdAt,
      });
    }

    const incoming = await FriendRequest.findOne({
      fromUserId: target._id,
      toUserId: viewer._id,
      status: "pending",
    }).select("_id createdAt");

    if (incoming) {
      return res.json({
        status: "incoming_request",
        requestId: incoming._id,
        createdAt: incoming.createdAt,
      });
    }

    return res.json({ status: "none" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to load friend status" });
  }
});

// GET /api/friends/list/:username
router.get("/list/:username", requireAuth, async (req, res) => {
  try {
    const username = String(req.params.username || "").trim();
    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    const profileUser = await User.findOne({ username })
      .populate("friends", "username createdAt lastLoginAt");

    if (!profileUser) {
      return res.status(404).json({ message: "Profile user not found" });
    }

    const friends = (profileUser.friends || [])
      .filter(Boolean)
      .sort((a, b) => String(a.username || "").localeCompare(String(b.username || "")))
      .map(normalizeFriendUser);

    res.json({ friends });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to load friends list" });
  }
});

// POST /api/friends/request/:username
router.post("/request/:username", requireAuth, async (req, res) => {
  try {
    const username = String(req.params.username || "").trim();
    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    const viewer = await User.findById(req.userId).select("_id username friends");
    if (!viewer) {
      return res.status(404).json({ message: "Viewer not found" });
    }

    const target = await User.findOne({ username }).select("_id username friends");
    if (!target) {
      return res.status(404).json({ message: "Target user not found" });
    }

    if (sameId(viewer._id, target._id)) {
      return res.status(400).json({ message: "You cannot add yourself as a friend" });
    }

    if (hasFriend(viewer, target._id)) {
      return res.status(400).json({ message: "You are already friends" });
    }

    const incomingPending = await FriendRequest.findOne({
      fromUserId: target._id,
      toUserId: viewer._id,
      status: "pending",
    }).select("_id");

    if (incomingPending) {
      return res.status(409).json({
        message: "This user already sent you a friend request",
        code: "INCOMING_REQUEST_EXISTS",
        requestId: incomingPending._id,
      });
    }

    let outgoing = await FriendRequest.findOne({
      fromUserId: viewer._id,
      toUserId: target._id,
    });

    if (outgoing?.status === "pending") {
      return res.status(409).json({
        message: "Friend request already sent",
        code: "OUTGOING_REQUEST_EXISTS",
        requestId: outgoing._id,
      });
    }

    if (outgoing) {
      outgoing.status = "pending";
      await outgoing.save();
    } else {
      outgoing = await FriendRequest.create({
        fromUserId: viewer._id,
        toUserId: target._id,
        status: "pending",
      });
    }

    res.status(201).json({
      request: {
        id: outgoing._id,
        status: outgoing.status,
        createdAt: outgoing.createdAt,
      },
    });
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(409).json({ message: "Friend request already exists" });
    }
    console.error(e);
    res.status(500).json({ message: "Failed to send friend request" });
  }
});

// POST /api/friends/request/:requestId/accept
router.post("/request/:requestId/accept", requireAuth, async (req, res) => {
  try {
    const requestId = String(req.params.requestId || "").trim();
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ message: "Invalid request id" });
    }

    const request = await FriendRequest.findOne({
      _id: requestId,
      toUserId: req.userId,
      status: "pending",
    });

    if (!request) {
      return res.status(404).json({ message: "Friend request not found" });
    }

    const fromUser = await User.findById(request.fromUserId).select("_id friends");
    const toUser = await User.findById(request.toUserId).select("_id friends");

    if (!fromUser || !toUser) {
      return res.status(404).json({ message: "User not found" });
    }

    await User.updateOne(
      { _id: fromUser._id },
      { $addToSet: { friends: toUser._id }, $set: { updatedAt: new Date() } }
    );

    await User.updateOne(
      { _id: toUser._id },
      { $addToSet: { friends: fromUser._id }, $set: { updatedAt: new Date() } }
    );

    request.status = "accepted";
    await request.save();

    // if both users had pending requests to each other, cancel the other one
    await FriendRequest.updateMany(
      {
        fromUserId: toUser._id,
        toUserId: fromUser._id,
        status: "pending",
      },
      { $set: { status: "cancelled", updatedAt: new Date() } }
    );

    res.json({ accepted: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to accept friend request" });
  }
});

// POST /api/friends/request/:requestId/decline
router.post("/request/:requestId/decline", requireAuth, async (req, res) => {
  try {
    const requestId = String(req.params.requestId || "").trim();
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ message: "Invalid request id" });
    }

    const request = await FriendRequest.findOne({
      _id: requestId,
      toUserId: req.userId,
      status: "pending",
    });

    if (!request) {
      return res.status(404).json({ message: "Friend request not found" });
    }

    request.status = "declined";
    await request.save();

    res.json({ declined: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to decline friend request" });
  }
});

// DELETE /api/friends/request/:username
// outgoing friend request cancellation (before it's accepted)
router.delete("/request/:username", requireAuth, async (req, res) => {
  try {
    const username = String(req.params.username || "").trim();
    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    const target = await User.findOne({ username }).select("_id");
    if (!target) {
      return res.status(404).json({ message: "Target user not found" });
    }

    const request = await FriendRequest.findOne({
      fromUserId: req.userId,
      toUserId: target._id,
      status: "pending",
    });

    if (!request) {
      return res.status(404).json({ message: "Outgoing friend request not found" });
    }

    request.status = "cancelled";
    await request.save();

    res.json({ cancelled: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to cancel friend request" });
  }
});

// DELETE /api/friends/remove/:username
router.delete("/remove/:username", requireAuth, async (req, res) => {
  try {
    const username = String(req.params.username || "").trim();
    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    const viewer = await User.findById(req.userId).select("_id");
    const target = await User.findOne({ username }).select("_id");

    if (!viewer || !target) {
      return res.status(404).json({ message: "User not found" });
    }

    if (sameId(viewer._id, target._id)) {
      return res.status(400).json({ message: "You cannot remove yourself" });
    }

    await User.updateOne(
      { _id: viewer._id },
      { $pull: { friends: target._id }, $set: { updatedAt: new Date() } }
    );

    await User.updateOne(
      { _id: target._id },
      { $pull: { friends: viewer._id }, $set: { updatedAt: new Date() } }
    );

    await FriendRequest.updateMany(
      {
        $or: [
          { fromUserId: viewer._id, toUserId: target._id, status: "pending" },
          { fromUserId: target._id, toUserId: viewer._id, status: "pending" },
        ],
      },
      { $set: { status: "cancelled", updatedAt: new Date() } }
    );

    res.json({ removed: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to remove friend" });
  }
});

// GET /api/friends/notifications/count
router.get("/notifications/count", requireAuth, async (req, res) => {
  try {
    const count = await FriendRequest.countDocuments({
      toUserId: req.userId,
      status: "pending",
    });

    res.json({ count });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to load notification count" });
  }
});

// GET /api/friends/notifications
router.get("/notifications", requireAuth, async (req, res) => {
  try {
    const requests = await FriendRequest.find({
      toUserId: req.userId,
      status: "pending",
    })
      .sort({ createdAt: -1 })
      .populate("fromUserId", "username")
      .limit(25);

    const notifications = requests.map((reqDoc) => ({
      requestId: reqDoc._id,
      createdAt: reqDoc.createdAt,
      type: "friend_request",
      fromUser: {
        id: reqDoc.fromUserId?._id ?? null,
        username: reqDoc.fromUserId?.username || "Unknown User",
        avatarUrl: null,
      },
    }));

    res.json({ notifications });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to load notifications" });
  }
});

export default router;