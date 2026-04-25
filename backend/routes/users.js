import express from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/validateEnv.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { User } from "../models/user.js";

const router = express.Router();

const DEFAULT_SETTINGS = Object.freeze({
  profile: {
    bio: "",
    links: {
      discord: "",
      youtube: "",
      twitch: "",
      steam: "",
      website: "",
    },
    optionalFields: {
      location: "",
      favoriteGenre: "",
      favoritePlatform: "",
    },
  },
  social: {
    showFriendsList: true,
    showReviews: true,
    showForumActivity: true,
    showFavoriteGames: true,
    showActivityHistory: true,
    allowProfileComments: true,
    showProfileComments: true,
  },
  privacy: {
    publicProfile: true,
    showProfileInSearch: true,
    allowDirectFriendRequests: true,
    cookies: {
      preferences: true,
      analytics: false,
    },
  },
  customization: {
    defaultExploreView: "grid",
    compactInterface: false,
    reducedMotion: false,
    liveSearchSuggestions: true,
  },
});

const LINK_RULES = {
  discord: {
    label: "Discord link",
    allowedHosts: ["discord.gg", "discord.com", "discordapp.com"]
  },
  youtube: {
    label: "YouTube link",
    allowedHosts: ["youtube.com", "youtu.be"]
  },
  twitch: {
    label: "Twitch link",
    allowedHosts: ["twitch.tv"]
  },
  steam: {
    label: "Steam link",
    allowedHosts: ["steamcommunity.com", "store.steampowered.com"]
  },
  website: {
    label: "Website link",
    allowedHosts: null
  }
};

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username is required")
  .max(20, "Username is too long");

const userSearchSchema = z
  .string()
  .trim()
  .max(50, "Search query is too long");

const settingsPatchSchema = z.object({
  profile: z.object({
    bio: z.string().trim().max(100, "Bio must be 100 characters or less").optional(),
    links: z.object({
      discord: z.string().trim().max(200).optional(),
      youtube: z.string().trim().max(200).optional(),
      twitch: z.string().trim().max(200).optional(),
      steam: z.string().trim().max(200).optional(),
      website: z.string().trim().max(200).optional(),
    }).partial().optional(),
    optionalFields: z.object({
      location: z.string().trim().max(80).optional(),
      favoriteGenre: z.string().trim().max(80).optional(),
      favoritePlatform: z.string().trim().max(80).optional(),
    }).partial().optional(),
  }).partial().optional(),

  social: z.object({
    showFriendsList: z.boolean().optional(),
    showReviews: z.boolean().optional(),
    showForumActivity: z.boolean().optional(),
    showFavoriteGames: z.boolean().optional(),
    showActivityHistory: z.boolean().optional(),
    allowProfileComments: z.boolean().optional(),
    showProfileComments: z.boolean().optional(),
  }).partial().optional(),

  privacy: z.object({
    publicProfile: z.boolean().optional(),
    showProfileInSearch: z.boolean().optional(),
    allowDirectFriendRequests: z.boolean().optional(),
    cookies: z.object({
      preferences: z.boolean().optional(),
      analytics: z.boolean().optional(),
    }).partial().optional(),
  }).partial().optional(),

  customization: z.object({
    defaultExploreView: z.enum(["grid", "compact", "table"]).optional(),
    compactInterface: z.boolean().optional(),
    reducedMotion: z.boolean().optional(),
    liveSearchSuggestions: z.boolean().optional(),
  }).partial().optional(),
}).strict();

function normalizeUsername(rawValue = "") {
  return String(rawValue || "").trim().toLowerCase();
}

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

function compactObject(obj) {
  if (!isPlainObject(obj)) return obj;

  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isPlainObject(value)) {
      const nested = compactObject(value);
      if (Object.keys(nested).length > 0) out[key] = nested;
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

function normalizeHostname(hostname = "") {
  return String(hostname || "").trim().toLowerCase().replace(/^www\./, "");
}

function hostMatchesAllowed(hostname, allowedHosts) {
  if (!Array.isArray(allowedHosts) || !allowedHosts.length) {
    return true;
  }

  const host = normalizeHostname(hostname);

  return allowedHosts.some((allowed) => {
    const safeAllowed = normalizeHostname(allowed);
    return host === safeAllowed || host.endsWith(`.${safeAllowed}`);
  });
}

function sanitizeExternalLink(rawValue, rule) {
  if (rawValue === undefined) {
    return { ok: true, value: undefined };
  }

  if (typeof rawValue !== "string") {
    return { ok: false, message: `${rule.label} must be a string` };
  }

  const trimmed = rawValue.trim();

  if (!trimmed) {
    return { ok: true, value: "" };
  }

  if (trimmed.length > 200) {
    return { ok: false, message: `${rule.label} is too long` };
  }

  let candidate = trimmed;

  if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  let url;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, message: `${rule.label} is not a valid URL` };
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    return { ok: false, message: `${rule.label} must use http or https` };
  }

  if (url.username || url.password) {
    return { ok: false, message: `${rule.label} must not contain embedded login data` };
  }

  if (!hostMatchesAllowed(url.hostname, rule.allowedHosts)) {
    return { ok: false, message: `${rule.label} must point to a valid ${rule.label.toLowerCase()} domain` };
  }

  return { ok: true, value: url.toString() };
}

function sanitizeSettingsLinks(patch) {
  if (!patch?.profile?.links) {
    return { ok: true, value: patch };
  }

  const nextPatch = structuredClone(patch);

  for (const [key, rule] of Object.entries(LINK_RULES)) {
    if (!(key in nextPatch.profile.links)) continue;

    const result = sanitizeExternalLink(nextPatch.profile.links[key], rule);
    if (!result.ok) {
      return { ok: false, message: result.message };
    }

    nextPatch.profile.links[key] = result.value;
  }

  return { ok: true, value: nextPatch };
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

function parseSearchQuery(value) {
  const parsed = userSearchSchema.safeParse(value);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message || "Invalid search query"
    };
  }

  return {
    ok: true,
    value: parsed.data
  };
}

function parseSettingsPatch(raw = {}) {
  const parsed = settingsPatchSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message || "Invalid settings payload"
    };
  }

  const linksResult = sanitizeSettingsLinks(parsed.data);
  if (!linksResult.ok) {
    return {
      ok: false,
      message: linksResult.message
    };
  }

  const patch = compactObject(linksResult.value);

  if (!Object.keys(patch).length) {
    return {
      ok: false,
      message: "No valid settings provided"
    };
  }

  return {
    ok: true,
    value: patch
  };
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
  const isPublic = settings.privacy.publicProfile !== false;

  if (!viewer) return isPublic;
  if (sameId(viewer._id, targetUser._id)) return true;
  if (hasFriend(viewer, targetUser._id)) return true;

  return isPublic;
}

function getPublicUsername(user) {
  return user?.displayUsername || user?.username || "";
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

// GET /api/users/me
router.get("/me", requireAuth, async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");

    const user = await User.findById(req.userId).select("username displayUsername createdAt lastLoginAt");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      id: user._id,
      username: getPublicUsername(user),
      createdAt: user.createdAt ?? user._id.getTimestamp(),
      lastLoginAt: user.lastLoginAt ?? null
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to load user" });
  }
});

// GET /api/users/settings
router.get("/settings", requireAuth, async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");

    const user = await User.findById(req.userId).select("settings");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      settings: normalizeSettings(user.settings),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to load settings" });
  }
});

// PATCH /api/users/settings
router.patch("/settings", requireAuth, async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");

    const patchResult = parseSettingsPatch(req.body);
    if (!patchResult.ok) {
      return res.status(400).json({ message: patchResult.message });
    }

    const user = await User.findById(req.userId).select("settings updatedAt");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const currentSettings = normalizeSettings(user.settings);
    const nextSettings = deepMerge(currentSettings, patchResult.value);

    user.settings = nextSettings;
    user.updatedAt = new Date();

    await user.save();

    res.json({
      message: "Settings updated successfully",
      settings: normalizeSettings(user.settings),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to update settings" });
  }
});

function escapeRegex(str = "") {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// GET /api/users/search?q=...
router.get("/search", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");

    const qResult = parseSearchQuery(req.query.q || "");
    if (!qResult.ok) {
      return res.status(400).json({ message: qResult.message });
    }

    const q = qResult.value;
    if (!q) {
      return res.json({ users: [] });
    }

    const safe = escapeRegex(normalizeUsername(q));

    const users = await User.find({
      username: { $regex: safe, $options: "i" },
      "settings.privacy.showProfileInSearch": { $ne: false }
    })
      .select("username displayUsername")
      .sort({ username: 1 })
      .limit(8);

    res.json({
      users: users.map((user) => ({
        id: user._id,
        username: getPublicUsername(user),
        avatarUrl: null
      }))
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to search users" });
  }
});

// GET /api/users/profile/:username
router.get("/profile/:username", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");

    const usernameResult = parseUsername(req.params.username);

    if (!usernameResult.ok) {
      return res.status(400).json({
        message: usernameResult.message
      });
    }

    const viewerId = getOptionalViewerId(req);

    const [viewer, user] = await Promise.all([
      viewerId
        ? User.findById(viewerId).select("_id username displayUsername friends")
        : null,
      User.findOne({
        username: usernameResult.normalizedValue
      }).select("username displayUsername createdAt lastLoginAt settings friends")
    ]);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const settings = normalizeSettings(user.settings);
    const isOwner = viewer ? sameId(viewer._id, user._id) : false;
    const isFriend = viewer ? hasFriend(viewer, user._id) : false;

    if (!canViewProfile(viewer, user)) {
      return res.status(403).json({
        message: "This profile is private"
      });
    }

    return res.json({
      id: user._id,
      username: getPublicUsername(user),
      createdAt: user.createdAt ?? user._id.getTimestamp(),
      lastLoginAt: user.lastLoginAt ?? null,
      settings,
      visibility: {
        isOwner,
        isFriend,
        publicProfile: settings.privacy.publicProfile !== false
      }
    });
  } catch (e) {
    console.error(e);

    return res.status(500).json({
      message: "Failed to load profile user"
    });
  }
});

export default router;