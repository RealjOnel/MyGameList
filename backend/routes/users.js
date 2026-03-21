import express from "express";
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

function trimString(value, max) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function boolOrUndefined(value) {
  return typeof value === "boolean" ? value : undefined;
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

function sanitizeSettingsPayload(raw = {}) {
  if (!isPlainObject(raw)) return {};

  const out = {};

  if (isPlainObject(raw.profile)) {
    out.profile = {};

    if (typeof raw.profile.bio === "string") {
      out.profile.bio = trimString(raw.profile.bio, 100);
    }

    if (isPlainObject(raw.profile.links)) {
      out.profile.links = {
        discord: typeof raw.profile.links.discord === "string" ? trimString(raw.profile.links.discord, 200) : undefined,
        youtube: typeof raw.profile.links.youtube === "string" ? trimString(raw.profile.links.youtube, 200) : undefined,
        twitch: typeof raw.profile.links.twitch === "string" ? trimString(raw.profile.links.twitch, 200) : undefined,
        website: typeof raw.profile.links.website === "string" ? trimString(raw.profile.links.website, 200) : undefined,
      };
    }

    if (isPlainObject(raw.profile.optionalFields)) {
      out.profile.optionalFields = {
        location: typeof raw.profile.optionalFields.location === "string" ? trimString(raw.profile.optionalFields.location, 80) : undefined,
        favoriteGenre: typeof raw.profile.optionalFields.favoriteGenre === "string" ? trimString(raw.profile.optionalFields.favoriteGenre, 80) : undefined,
        favoritePlatform: typeof raw.profile.optionalFields.favoritePlatform === "string" ? trimString(raw.profile.optionalFields.favoritePlatform, 80) : undefined,
      };
    }
  }

  if (isPlainObject(raw.social)) {
    out.social = {
      showFriendsList: boolOrUndefined(raw.social.showFriendsList),
      showReviews: boolOrUndefined(raw.social.showReviews),
      showForumActivity: boolOrUndefined(raw.social.showForumActivity),
      showFavoriteGames: boolOrUndefined(raw.social.showFavoriteGames),
      showActivityHistory: boolOrUndefined(raw.social.showActivityHistory),
      allowProfileComments: boolOrUndefined(raw.social.allowProfileComments),
    };
  }

  if (isPlainObject(raw.privacy)) {
    out.privacy = {
      publicProfile: boolOrUndefined(raw.privacy.publicProfile),
      showProfileInSearch: boolOrUndefined(raw.privacy.showProfileInSearch),
      allowDirectFriendRequests: boolOrUndefined(raw.privacy.allowDirectFriendRequests),
    };

    if (isPlainObject(raw.privacy.cookies)) {
      out.privacy.cookies = {
        preferences: boolOrUndefined(raw.privacy.cookies.preferences),
        analytics: boolOrUndefined(raw.privacy.cookies.analytics),
      };
    }
  }

  if (isPlainObject(raw.customization)) {
    out.customization = {
      compactInterface: boolOrUndefined(raw.customization.compactInterface),
      reducedMotion: boolOrUndefined(raw.customization.reducedMotion),
      liveSearchSuggestions: boolOrUndefined(raw.customization.liveSearchSuggestions),
    };

    if (
      typeof raw.customization.defaultExploreView === "string" &&
      ["grid", "compact", "table"].includes(raw.customization.defaultExploreView)
    ) {
      out.customization.defaultExploreView = raw.customization.defaultExploreView;
    }
  }

  return compactObject(out);
}

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

    const patch = sanitizeSettingsPayload(req.body);
    if (!Object.keys(patch).length) {
      return res.status(400).json({ message: "No valid settings provided" });
    }

    const user = await User.findById(req.userId).select("settings updatedAt");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const currentSettings = normalizeSettings(user.settings);
    const nextSettings = deepMerge(currentSettings, patch);

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

    const q = String(req.query.q || "").trim();
    if (!q) {
      return res.json({ users: [] });
    }

    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const users = await User.find({
      username: { $regex: safe, $options: "i" },
      "settings.privacy.showProfileInSearch": { $ne: false }
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

    const user = await User.findOne({ username }).select("username createdAt lastLoginAt settings");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const settings = normalizeSettings(user.settings);
    const isSelf = String(user._id) === String(req.userId);

    if (!isSelf && settings.privacy.publicProfile === false) {
      return res.status(403).json({ message: "This profile is private" });
    }

    res.json({
      id: user._id,
      username: user.username,
      createdAt: user.createdAt ?? user._id.getTimestamp(),
      lastLoginAt: user.lastLoginAt ?? null,
      settings
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to load profile user" });
  }
});

export default router;