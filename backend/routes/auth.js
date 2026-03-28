import express from "express";
import bcrypt from "bcrypt";
import { User } from "../models/user.js";
import { RefreshToken } from "../models/refreshToken.js";
import { registerSchema, loginSchema } from "../validators/authValidator.js";
import {
  createAccessToken,
  createRefreshTokenValue,
  hashRefreshToken
} from "../utils/authTokens.js";
import {
  getClientIp,
  getUserAgent,
  logSecurityEvent,
  logSecurityWarn,
  logSecurityError
} from "../utils/securityLogger.js";

const router = express.Router();

function normalizeUsername(rawValue = "") {
  const displayUsername = String(rawValue || "").trim();
  const normalizedUsername = displayUsername.toLowerCase();

  return {
    displayUsername,
    normalizedUsername
  };
}

function getRefreshCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  const isCrossSite = process.env.COOKIE_CROSS_SITE === "true";

  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isCrossSite ? "none" : "lax",
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 30
  };
}

function setRefreshCookie(res, token) {
  res.cookie("refreshToken", token, getRefreshCookieOptions());
}

function clearRefreshCookie(res) {
  res.clearCookie("refreshToken", {
    ...getRefreshCookieOptions(),
    maxAge: undefined
  });
}

// REGISTER
router.post("/register", async (req, res) => {
  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);

  try {
    const parsed = registerSchema.safeParse(req.body);

    if (!parsed.success) {
      logSecurityWarn("register_invalid_input", {
        ip,
        userAgent
      });

      return res.status(400).json({ message: "Invalid input" });
    }

    const { username, email, password } = parsed.data;
    const { displayUsername, normalizedUsername } = normalizeUsername(username);

    const existingUser = await User.findOne({ username: normalizedUsername });
    if (existingUser) {
      logSecurityWarn("register_username_exists", {
        username: normalizedUsername,
        displayUsername,
        ip,
        userAgent
      });

      return res.status(400).json({ message: "Username already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date();

    const user = new User({
      username: normalizedUsername,
      displayUsername,
      email,
      passwordHash,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now
    });

    await user.save();

    const accessToken = createAccessToken(user._id);

    const refreshTokenValue = createRefreshTokenValue();
    const refreshTokenHash = hashRefreshToken(refreshTokenValue);

    await RefreshToken.create({
      userId: user._id,
      tokenHash: refreshTokenHash,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      userAgent,
      ip
    });

    setRefreshCookie(res, refreshTokenValue);

    logSecurityEvent("register_success", {
      userId: String(user._id),
      username: user.username,
      displayUsername: user.displayUsername,
      ip,
      userAgent
    });

    res.json({ token: accessToken });
  } catch (err) {
    logSecurityError("register_failed", {
      ip,
      userAgent,
      message: err?.message
    });

    console.error(err);
    res.status(500).json({ message: "Registration failed" });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);

  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      logSecurityWarn("login_invalid_input", {
        ip,
        userAgent
      });

      return res.status(400).json({ message: "Invalid input" });
    }

    const { username, password } = parsed.data;
    const { normalizedUsername } = normalizeUsername(username);

    const user = await User.findOne({ username: normalizedUsername });
    if (!user) {
      logSecurityWarn("login_failed", {
        username: normalizedUsername,
        reason: "invalid_credentials",
        ip,
        userAgent
      });

      return res.status(400).json({ message: "Invalid username or password" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      logSecurityWarn("login_failed", {
        username: normalizedUsername,
        reason: "invalid_credentials",
        ip,
        userAgent
      });

      return res.status(400).json({ message: "Invalid username or password" });
    }

    user.lastLoginAt = new Date();
    user.updatedAt = new Date();
    await user.save();

    const accessToken = createAccessToken(user._id);

    const refreshTokenValue = createRefreshTokenValue();
    const refreshTokenHash = hashRefreshToken(refreshTokenValue);

    await RefreshToken.create({
      userId: user._id,
      tokenHash: refreshTokenHash,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      userAgent,
      ip
    });

    setRefreshCookie(res, refreshTokenValue);

    logSecurityEvent("login_success", {
      userId: String(user._id),
      username: user.username,
      displayUsername: user.displayUsername,
      ip,
      userAgent
    });

    res.json({ token: accessToken });
  } catch (err) {
    logSecurityError("login_error", {
      username: req.body?.username,
      ip,
      userAgent,
      message: err?.message
    });

    console.error(err);
    res.status(500).json({ message: "Login failed" });
  }
});

// REFRESH
router.post("/auth/refresh", async (req, res) => {
  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);

  try {
    const refreshTokenValue = req.cookies?.refreshToken;

    if (!refreshTokenValue) {
      logSecurityWarn("refresh_missing_token", {
        ip,
        userAgent
      });

      return res.status(401).json({ message: "Missing refresh token" });
    }

    const refreshTokenHash = hashRefreshToken(refreshTokenValue);

    const existingToken = await RefreshToken.findOne({
      tokenHash: refreshTokenHash
    });

    if (!existingToken) {
      clearRefreshCookie(res);

      logSecurityWarn("refresh_invalid_token", {
        ip,
        userAgent
      });

      return res.status(401).json({ message: "Invalid refresh token" });
    }

    if (existingToken.revokedAt) {
      clearRefreshCookie(res);

      logSecurityWarn("refresh_revoked_token", {
        userId: String(existingToken.userId),
        ip,
        userAgent
      });

      return res.status(401).json({ message: "Refresh token already revoked" });
    }

    if (existingToken.expiresAt < new Date()) {
      existingToken.revokedAt = new Date();
      await existingToken.save();
      clearRefreshCookie(res);

      logSecurityWarn("refresh_expired_token", {
        userId: String(existingToken.userId),
        ip,
        userAgent
      });

      return res.status(401).json({ message: "Refresh token expired" });
    }

    const newRefreshTokenValue = createRefreshTokenValue();
    const newRefreshTokenHash = hashRefreshToken(newRefreshTokenValue);

    existingToken.revokedAt = new Date();
    existingToken.replacedByTokenHash = newRefreshTokenHash;
    await existingToken.save();

    await RefreshToken.create({
      userId: existingToken.userId,
      tokenHash: newRefreshTokenHash,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      userAgent,
      ip
    });

    const accessToken = createAccessToken(existingToken.userId);

    setRefreshCookie(res, newRefreshTokenValue);

    logSecurityEvent("refresh_success", {
      userId: String(existingToken.userId),
      ip,
      userAgent
    });

    return res.json({ token: accessToken });
  } catch (err) {
    logSecurityError("refresh_error", {
      ip,
      userAgent,
      message: err?.message
    });

    console.error(err);
    return res.status(500).json({ message: "Refresh failed" });
  }
});

// LOGOUT
router.post("/auth/logout", async (req, res) => {
  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);

  try {
    const refreshTokenValue = req.cookies?.refreshToken;

    if (refreshTokenValue) {
      const tokenHash = hashRefreshToken(refreshTokenValue);

      await RefreshToken.updateOne(
        { tokenHash, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
    }

    clearRefreshCookie(res);

    logSecurityEvent("logout_success", {
      ip,
      userAgent
    });

    return res.json({ ok: true });
  } catch (err) {
    logSecurityError("logout_error", {
      ip,
      userAgent,
      message: err?.message
    });

    console.error(err);
    return res.status(500).json({ message: "Logout failed" });
  }
});

export default router;