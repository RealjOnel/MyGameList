import express from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/validateEnv.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { User } from "../models/user.js";
import multer from "multer";
import { cloudinary } from "../services/cloudinary.js";
import bcrypt from "bcrypt";
import { RefreshToken } from "../models/refreshToken.js";
import crypto from "crypto";
import { EmailChangeToken } from "../models/emailChangeToken.js";
import { sendEmailChangeVerificationMail } from "../services/emailChangeMailer.js";

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

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const MAX_PROFILE_MEDIA_BYTES = 6 * 1024 * 1024; // 6 MB

const uploadProfileMedia = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_PROFILE_MEDIA_BYTES
  },
  fileFilter(req, file, cb) {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error("Only JPG, PNG or WEBP images are allowed"));
    }

    cb(null, true);
  }
});

function parseMediaType(value) {
  const raw = String(value || "").trim().toLowerCase();

  if (!["avatar", "banner"].includes(raw)) {
    return {
      ok: false,
      message: "Invalid media type"
    };
  }

  return {
    ok: true,
    value: raw
  };
}

function uploadBufferToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error || !result) {
          return reject(error || new Error("Cloudinary upload failed"));
        }
        resolve(result);
      }
    );

    stream.end(buffer);
  });
}

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

// Username change helpers

const USERNAME_CHANGE_INTERVAL_DAYS = 14;
const USERNAME_CHANGE_INTERVAL_MS = USERNAME_CHANGE_INTERVAL_DAYS * 24 * 60 * 60 * 1000;

const usernameUpdateSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters long")
    .max(20, "Username must be 20 characters or less")
    .regex(/^[A-Za-z0-9_]+$/, "Username may only contain letters, numbers and underscores")
}).strict();

function parseUsernameUpdateBody(raw = {}) {
  const parsed = usernameUpdateSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message || "Invalid username payload"
    };
  }

  return {
    ok: true,
    value: parsed.data
  };
}

function getUsernameChangeBaseDate(user) {
  return user?.usernameChangedAt || user?.createdAt || user?._id?.getTimestamp?.() || new Date();
}

function getUsernameChangeInfo(user) {
  const now = Date.now();
  const lastChangedAt = new Date(getUsernameChangeBaseDate(user));
  const nextChangeAt = new Date(lastChangedAt.getTime() + USERNAME_CHANGE_INTERVAL_MS);
  const canChangeNow = now >= nextChangeAt.getTime();
  const waitDaysRemaining = canChangeNow
    ? 0
    : Math.ceil((nextChangeAt.getTime() - now) / (24 * 60 * 60 * 1000));

  return {
    canChangeNow,
    minDaysBetweenChanges: USERNAME_CHANGE_INTERVAL_DAYS,
    lastChangedAt,
    nextChangeAt,
    waitDaysRemaining
  };
}

// E-Mail change helpers

function normalizeEmail(rawValue = "") {
  return String(rawValue || "").trim().toLowerCase();
}

function createEmailChangeTokenValue() {
  return crypto.randomBytes(32).toString("hex");
}

function hashEmailChangeToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

const emailChangeRequestSchema = z.object({
  newEmail: z.string().trim().email("Please enter a valid email address").max(200),
  currentPassword: z.string().min(1, "Current password is required").max(200)
}).strict();

const emailVerifySchema = z.object({
  token: z.string().min(1, "Verification token is required").max(500)
}).strict();

function parseEmailChangeRequestBody(raw = {}) {
  const parsed = emailChangeRequestSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message || "Invalid email change payload"
    };
  }

  return {
    ok: true,
    value: {
      newEmail: normalizeEmail(parsed.data.newEmail),
      currentPassword: String(parsed.data.currentPassword || "").trim()
    }
  };
}

function parseEmailVerifyBody(raw = {}) {
  const parsed = emailVerifySchema.safeParse(raw);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message || "Invalid verification token"
    };
  }

  return {
    ok: true,
    value: {
      token: String(parsed.data.token || "").trim()
    }
  };
}


// Password validation helpers
const weakPasswords = new Set(["123456", "password", "qwerty", "abc123"]);

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required").max(200),
  newPassword: z.string().min(1, "New password is required").max(200)
}).strict();

function validateNewPasswordValue(rawValue = "") {
  const value = String(rawValue || "").trim();

  if (!value) {
    return {
      ok: false,
      message: "New password is required"
    };
  }

  if (value.length < 8) {
    return {
      ok: false,
      message: "Password must be at least 8 characters long"
    };
  }

  if (!/[A-Z]/.test(value)) {
    return {
      ok: false,
      message: "Password must include at least one uppercase letter"
    };
  }

  if (!/[a-z]/.test(value)) {
    return {
      ok: false,
      message: "Password must include at least one lowercase letter"
    };
  }

  if (!/\d/.test(value)) {
    return {
      ok: false,
      message: "Password must include at least one number"
    };
  }

  if (weakPasswords.has(value.toLowerCase())) {
    return {
      ok: false,
      message: "This password is too common. Please choose a stronger one."
    };
  }

  return {
    ok: true,
    value
  };
}

function parsePasswordChangeBody(raw = {}) {
  const parsed = passwordChangeSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message || "Invalid password payload"
    };
  }

  const currentPassword = String(parsed.data.currentPassword || "").trim();
  const newPasswordValidation = validateNewPasswordValue(parsed.data.newPassword);

  if (!currentPassword) {
    return {
      ok: false,
      message: "Current password is required"
    };
  }

  if (!newPasswordValidation.ok) {
    return newPasswordValidation;
  }

  return {
    ok: true,
    value: {
      currentPassword,
      newPassword: newPasswordValidation.value
    }
  };
}

// GET /api/users/me
router.get("/me", requireAuth, async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");

    const user = await User.findById(req.userId).select("username displayUsername createdAt lastLoginAt avatarUrl bannerUrl usernameChangedAt");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      id: user._id,
      username: getPublicUsername(user),
      createdAt: user.createdAt ?? user._id.getTimestamp(),
      lastLoginAt: user.lastLoginAt ?? null,
      avatarUrl: user.avatarUrl ?? null,
      bannerUrl: user.bannerUrl ?? null,
      usernameChange: getUsernameChangeInfo(user)
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

    const user = await User.findById(req.userId).select("settings avatarUrl bannerUrl username displayUsername email usernameChangedAt createdAt");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      settings: normalizeSettings(user.settings),
      avatarUrl: user.avatarUrl ?? null,
      bannerUrl: user.bannerUrl ?? null,
      username: getPublicUsername(user),
      email: user.email ?? "",
      usernameChange: getUsernameChangeInfo(user)
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

// PATCH /api/users/username
router.patch("/username", requireAuth, async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");

    const bodyResult = parseUsernameUpdateBody(req.body);
    if (!bodyResult.ok) {
      return res.status(400).json({ message: bodyResult.message });
    }

    const desiredDisplayUsername = bodyResult.value.username.trim();
    const desiredNormalizedUsername = normalizeUsername(desiredDisplayUsername);

    const user = await User.findById(req.userId).select(
      "username displayUsername createdAt updatedAt usernameChangedAt avatarUrl bannerUrl"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (desiredNormalizedUsername === user.username) {
      return res.json({
        message: "Username unchanged",
        username: getPublicUsername(user),
        avatarUrl: user.avatarUrl ?? null,
        bannerUrl: user.bannerUrl ?? null,
        usernameChange: getUsernameChangeInfo(user)
      });
    }

    const changeInfo = getUsernameChangeInfo(user);

    if (!changeInfo.canChangeNow) {
      return res.status(429).json({
        message: `You can change your username again in ${changeInfo.waitDaysRemaining} day(s).`,
        usernameChange: changeInfo
      });
    }

    const existingUser = await User.findOne({ username: desiredNormalizedUsername }).select("_id");
    if (existingUser && !sameId(existingUser._id, user._id)) {
      return res.status(409).json({ message: "This username is already taken" });
    }

    const now = new Date();

    user.username = desiredNormalizedUsername;
    user.displayUsername = desiredDisplayUsername;
    user.usernameChangedAt = now;
    user.updatedAt = now;

    await user.save();

    return res.json({
      message: "Username updated successfully",
      username: getPublicUsername(user),
      avatarUrl: user.avatarUrl ?? null,
      bannerUrl: user.bannerUrl ?? null,
      usernameChange: getUsernameChangeInfo(user)
    });
  } catch (e) {
    if (String(e?.code) === "11000") {
      return res.status(409).json({ message: "This username is already taken" });
    }

    console.error(e);
    return res.status(500).json({ message: "Failed to update username" });
  }
});

// PATCH /api/users/password
router.patch("/password", requireAuth, async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");

    const bodyResult = parsePasswordChangeBody(req.body);

    if (!bodyResult.ok) {
      return res.status(400).json({
        message: bodyResult.message
      });
    }

    const { currentPassword, newPassword } = bodyResult.value;

    const user = await User.findById(req.userId).select("_id passwordHash tokenVersion updatedAt");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const isSameAsCurrent = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSameAsCurrent) {
      return res.status(400).json({ message: "New password must be different from the current password" });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.tokenVersion = Number(user.tokenVersion || 0) + 1;
    user.updatedAt = new Date();

    await user.save();

    await RefreshToken.updateMany(
      { userId: user._id, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );

    return res.json({
      message: "Password updated successfully. Please log in again on all devices."
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Failed to update password" });
  }
});

// POST /api/users/email/request
router.post("/email/request", requireAuth, async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    console.log("[email/request] start", { userId: req.userId });

    const bodyResult = parseEmailChangeRequestBody(req.body);
    if (!bodyResult.ok) {
      console.log("[email/request] invalid body", { message: bodyResult.message });
      return res.status(400).json({ message: bodyResult.message });
    }

    const { newEmail, currentPassword } = bodyResult.value;
    console.log("[email/request] parsed body", { newEmail });

    const user = await User.findById(req.userId).select("_id email displayUsername passwordHash updatedAt");
    console.log("[email/request] user loaded", { found: Boolean(user) });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const currentEmail = normalizeEmail(user.email);
    if (newEmail === currentEmail) {
      console.log("[email/request] same email");
      return res.status(400).json({ message: "That is already your current email address" });
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    console.log("[email/request] password checked", { ok: isCurrentPasswordValid });

    if (!isCurrentPasswordValid) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const existingUser = await User.findOne({ email: newEmail }).select("_id");
    console.log("[email/request] existing email checked", { exists: Boolean(existingUser) });

    if (existingUser && !sameId(existingUser._id, user._id)) {
      return res.status(409).json({ message: "This email address is already in use" });
    }

    await EmailChangeToken.deleteMany({ userId: user._id });
    console.log("[email/request] old tokens deleted");

    const tokenValue = createEmailChangeTokenValue();
    const tokenHash = hashEmailChangeToken(tokenValue);

    await EmailChangeToken.create({
      userId: user._id,
      newEmail,
      tokenHash,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60)
    });
    console.log("[email/request] token created");

    const verifyUrl = `${env.FRONTEND_ORIGIN}/OtherPages/email_change.html?token=${encodeURIComponent(tokenValue)}`;
    console.log("[email/request] verify url built", { verifyUrl });

    await sendEmailChangeVerificationMail({
      to: newEmail,
      username: getPublicUsername(user),
      verifyUrl
    });
    console.log("[email/request] mail sent");

    return res.json({
      message: "Verification email sent to your new email address"
    });
  } catch (e) {
    console.error("[email/request] failed", {
      message: e?.message,
      code: e?.code,
      stack: e?.stack
    });
    return res.status(500).json({ message: "Failed to send email verification" });
  }
});

// POST /api/users/email/verify
router.post("/email/verify", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");

    const bodyResult = parseEmailVerifyBody(req.body);
    if (!bodyResult.ok) {
      return res.status(400).json({ message: bodyResult.message });
    }

    const tokenHash = hashEmailChangeToken(bodyResult.value.token);

    const changeRequest = await EmailChangeToken.findOne({
      tokenHash,
      expiresAt: { $gt: new Date() }
    }).select("userId newEmail");

    if (!changeRequest) {
      return res.status(400).json({ message: "This email verification link is invalid or has expired" });
    }

    const user = await User.findById(changeRequest.userId).select("_id email tokenVersion updatedAt");
    if (!user) {
      await EmailChangeToken.deleteMany({ userId: changeRequest.userId });
      return res.status(404).json({ message: "User not found" });
    }

    const existingUser = await User.findOne({ email: changeRequest.newEmail }).select("_id");
    if (existingUser && !sameId(existingUser._id, user._id)) {
      await EmailChangeToken.deleteMany({ userId: user._id });
      return res.status(409).json({ message: "This email address is already in use" });
    }

    user.email = changeRequest.newEmail;
    user.tokenVersion = Number(user.tokenVersion || 0) + 1;
    user.updatedAt = new Date();

    await user.save();

    await RefreshToken.updateMany(
      { userId: user._id, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );

    await EmailChangeToken.deleteMany({ userId: user._id });

    return res.json({
      message: "Email updated successfully. Please log in again."
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Failed to verify email change" });
  }
});

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
      .select("username displayUsername avatarUrl")
      .sort({ username: 1 })
      .limit(8);

    res.json({
      users: users.map((user) => ({
        id: user._id,
        username: getPublicUsername(user),
        avatarUrl: user.avatarUrl || null
      }))
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to search users" });
  }
});

// POST /api/users/profile-media/:type
router.post(
  "/profile-media/:type",
  requireAuth,
  (req, res, next) => {
    uploadProfileMedia.single("image")(req, res, (err) => {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message: "Image must be 6MB or smaller"
        });
      }

      if (err) {
        return res.status(400).json({
          message: err.message || "Invalid image upload"
        });
      }

      next();
    });
  },
  async (req, res) => {
    try {
      const typeResult = parseMediaType(req.params.type);
      if (!typeResult.ok) {
        return res.status(400).json({ message: typeResult.message });
      }

      if (!req.file?.buffer) {
        return res.status(400).json({ message: "No image uploaded" });
      }

      const user = await User.findById(req.userId).select("avatarUrl bannerUrl updatedAt");
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const type = typeResult.value;

      const uploadOptions =
        type === "avatar"
          ? {
              folder: "mygamelist/avatars",
              public_id: `${req.userId}_avatar`,
              overwrite: true,
              invalidate: true,
              resource_type: "image",
              transformation: [
                {
                  width: 512,
                  height: 512,
                  crop: "fill",
                  gravity: "auto",
                  fetch_format: "auto",
                  quality: "auto"
                }
              ]
            }
          : {
              folder: "mygamelist/banners",
              public_id: `${req.userId}_banner`,
              overwrite: true,
              invalidate: true,
              resource_type: "image",
              transformation: [
                {
                  width: 1600,
                  height: 400,
                  crop: "fill",
                  gravity: "auto",
                  fetch_format: "auto",
                  quality: "auto"
                }
              ]
            };

      const result = await uploadBufferToCloudinary(req.file.buffer, uploadOptions);

      if (type === "avatar") {
        user.avatarUrl = result.secure_url;
      } else {
        user.bannerUrl = result.secure_url;
      }

      user.updatedAt = new Date();
      await user.save();

      return res.json({
        message: `${type === "avatar" ? "Avatar" : "Banner"} updated successfully`,
        avatarUrl: user.avatarUrl ?? null,
        bannerUrl: user.bannerUrl ?? null
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ message: "Failed to upload profile media" });
    }
  }
);

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
      }).select("username displayUsername createdAt lastLoginAt settings friends avatarUrl bannerUrl")
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
      avatarUrl: user.avatarUrl ?? null,
      bannerUrl: user.bannerUrl ?? null,
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