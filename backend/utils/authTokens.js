import crypto from "crypto";
import jwt from "jsonwebtoken";

export function createAccessToken(userId, tokenVersion = 0) {
  return jwt.sign(
    {
      id: String(userId),
      tokenVersion: Number(tokenVersion || 0)
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
}

export function createRefreshTokenValue() {
  return crypto.randomBytes(64).toString("hex");
}

export function hashRefreshToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}