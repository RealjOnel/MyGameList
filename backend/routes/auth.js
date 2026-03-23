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

const router = express.Router();

function getRefreshCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  const isCrossSite = process.env.COOKIE_CROSS_SITE === "true";

  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isCrossSite ? "none" : "lax",
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 30 // 30 Days
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
  try {
    const parsed = registerSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const { username, email, password } = parsed.data;

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: "Username already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date();

    const user = new User({
      username,
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
      userAgent: req.get("user-agent") || "",
      ip: req.ip || ""
    });

    setRefreshCookie(res, refreshTokenValue);

    res.json({ token: accessToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Registration failed" });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const { username, password } = parsed.data;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: "Invalid username or password" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
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
      userAgent: req.get("user-agent") || "",
      ip: req.ip || ""
    });

    setRefreshCookie(res, refreshTokenValue);

    res.json({ token: accessToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Login failed" });
  }
});

// REFRESH
router.post("/auth/refresh", async (req, res) => {
  try {
    const refreshTokenValue = req.cookies?.refreshToken;

    if (!refreshTokenValue) {
      return res.status(401).json({ message: "Missing refresh token" });
    }

    const refreshTokenHash = hashRefreshToken(refreshTokenValue);

    const existingToken = await RefreshToken.findOne({
      tokenHash: refreshTokenHash
    });

    if (!existingToken) {
      clearRefreshCookie(res);
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    if (existingToken.revokedAt) {
      clearRefreshCookie(res);
      return res.status(401).json({ message: "Refresh token already revoked" });
    }

    if (existingToken.expiresAt < new Date()) {
      existingToken.revokedAt = new Date();
      await existingToken.save();
      clearRefreshCookie(res);
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
      userAgent: req.get("user-agent") || "",
      ip: req.ip || ""
    });

    const accessToken = createAccessToken(existingToken.userId);

    setRefreshCookie(res, newRefreshTokenValue);

    return res.json({ token: accessToken });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Refresh failed" });
  }
});

// LOGOUT
router.post("/auth/logout", async (req, res) => {
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

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Logout failed" });
  }
});

export default router;