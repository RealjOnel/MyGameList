import express from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/validateEnv.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { User } from "../models/user.js";
import { FriendRequest } from "../models/friendRequest.js";
import { sendFriendRequestLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username is required")
  .max(20, "Username is too long");

function normalizeUsername(rawValue = "") {
  return String(rawValue || "").trim().toLowerCase();
}

function getPublicUsername(user) {
  return user?.displayUsername || user?.username || "Unknown User";
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

function sameId(a, b) {
  return String(a) === String(b);
}

function hasFriend(user, targetUserId) {
  return Array.isArray(user?.friends) && user.friends.some((id) => sameId(id, targetUserId));
}

function normalizeFriendUser(user) {
  return {
    id: user._id,
    username: getPublicUsername(user),
    avatarUrl: user?.avatarUrl ?? null,
    createdAt: user.createdAt ?? null,
    lastLoginAt: user.lastLoginAt ?? null,
  };
}

function allowsDirectFriendRequests(user) {
  return user?.settings?.privacy?.allowDirectFriendRequests !== false;
}

function normalizeProfileSettings(settings = {}) {
  const raw = settings?.toObject ? settings.toObject() : settings || {};

  return {
    social: {
      showFriendsList: raw?.social?.showFriendsList !== false
    },
    privacy: {
      publicProfile: raw?.privacy?.publicProfile !== false
    }
  };
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

function canViewProfile(viewer, targetUser) {
  if (!targetUser) return false;

  const settings = normalizeProfileSettings(targetUser.settings);

  if (!viewer) {
    return settings.privacy.publicProfile !== false;
  }

  if (sameId(viewer._id, targetUser._id)) return true;
  if (hasFriend(viewer, targetUser._id)) return true;

  return settings.privacy.publicProfile !== false;
}

function canViewFriendsList(viewer, targetUser) {
  if (!targetUser) return false;

  const settings = normalizeProfileSettings(targetUser.settings);

  if (viewer && sameId(viewer._id, targetUser._id)) {
    return true;
  }

  if (settings.social.showFriendsList === false) {
    return false;
  }

  return canViewProfile(viewer, targetUser);
}

// GET /api/friends/status/:username
router.get("/status/:username", requireAuth, async (req, res) => {
  try {
    const usernameResult = parseUsername(req.params.username);
    if (!usernameResult.ok) {
      return res.status(400).json({ message: usernameResult.message });
    }

    const viewer = await User.findById(req.userId).select("_id username displayUsername friends");
    if (!viewer) {
      return res.status(404).json({ message: "Viewer not found" });
    }

    const target = await User.findOne({ username: usernameResult.normalizedValue })
      .select("_id username displayUsername settings");

    if (!target) {
      return res.status(404).json({ message: "Target user not found" });
    }

    const directRequestsAllowed = allowsDirectFriendRequests(target);

    if (sameId(viewer._id, target._id)) {
      return res.json({
        status: "self",
        directRequestsAllowed: true
      });
    }

    if (hasFriend(viewer, target._id)) {
      return res.json({
        status: "friends",
        directRequestsAllowed
      });
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
        directRequestsAllowed
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
        directRequestsAllowed
      });
    }

    return res.json({
      status: "none",
      directRequestsAllowed
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to load friend status" });
  }
});

// GET /api/friends/list/:username
router.get("/list/:username", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");

    const usernameResult = parseUsername(req.params.username);
    if (!usernameResult.ok) {
      return res.status(400).json({ message: usernameResult.message });
    }

    const viewerId = getOptionalViewerId(req);

    const [viewer, profileUser] = await Promise.all([
      viewerId
        ? User.findById(viewerId).select("_id username displayUsername friends")
        : null,

      User.findOne({ username: usernameResult.normalizedValue })
        .select("_id username displayUsername settings friends")
        .populate("friends", "username displayUsername avatarUrl createdAt lastLoginAt")
    ]);

    if (!profileUser) {
      return res.status(404).json({ message: "Profile user not found" });
    }

    if (!canViewFriendsList(viewer, profileUser)) {
      return res.status(403).json({ message: "This friends list is private" });
    }

    const friends = (profileUser.friends || [])
      .filter(Boolean)
      .sort((a, b) => String(getPublicUsername(a)).localeCompare(String(getPublicUsername(b))))
      .map(normalizeFriendUser);

    res.json({ friends });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to load friends list" });
  }
});

// POST /api/friends/request/:username
router.post("/request/:username", requireAuth, sendFriendRequestLimiter, async (req, res) => {
  try {
    const usernameResult = parseUsername(req.params.username);
    if (!usernameResult.ok) {
      return res.status(400).json({ message: usernameResult.message });
    }

    const viewer = await User.findById(req.userId).select("_id username displayUsername friends");
    if (!viewer) {
      return res.status(404).json({ message: "Viewer not found" });
    }

    const target = await User.findOne({ username: usernameResult.normalizedValue })
      .select("_id username displayUsername friends settings");

    if (!target) {
      return res.status(404).json({ message: "Target user not found" });
    }

    if (sameId(viewer._id, target._id)) {
      return res.status(400).json({ message: "You cannot add yourself as a friend" });
    }

    if (hasFriend(viewer, target._id)) {
      return res.status(400).json({ message: "You are already friends" });
    }

    if (!allowsDirectFriendRequests(target)) {
      return res.status(403).json({
        message: "This user does not allow direct friend requests",
        code: "DIRECT_REQUESTS_DISABLED",
      });
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
    const requestIdResult = parseObjectId(req.params.requestId, "Request id");
    if (!requestIdResult.ok) {
      return res.status(400).json({ message: requestIdResult.message });
    }

    const request = await FriendRequest.findOne({
      _id: requestIdResult.value,
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
    const requestIdResult = parseObjectId(req.params.requestId, "Request id");
    if (!requestIdResult.ok) {
      return res.status(400).json({ message: requestIdResult.message });
    }

    const request = await FriendRequest.findOne({
      _id: requestIdResult.value,
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
router.delete("/request/:username", requireAuth, async (req, res) => {
  try {
    const usernameResult = parseUsername(req.params.username);
    if (!usernameResult.ok) {
      return res.status(400).json({ message: usernameResult.message });
    }

    const target = await User.findOne({ username: usernameResult.normalizedValue }).select("_id");
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
    const usernameResult = parseUsername(req.params.username);
    if (!usernameResult.ok) {
      return res.status(400).json({ message: usernameResult.message });
    }

    const viewer = await User.findById(req.userId).select("_id");
    const target = await User.findOne({ username: usernameResult.normalizedValue }).select("_id");

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
      .populate("fromUserId", "username displayUsername avatarUrl")
      .limit(25);

    const notifications = requests.map((reqDoc) => ({
      requestId: reqDoc._id,
      createdAt: reqDoc.createdAt,
      type: "friend_request",
      fromUser: {
        id: reqDoc.fromUserId?._id ?? null,
        username: getPublicUsername(reqDoc.fromUserId),
        avatarUrl: reqDoc.fromUserId?.avatarUrl ?? null,
      },
    }));

    res.json({ notifications });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to load notifications" });
  }
});

export default router;