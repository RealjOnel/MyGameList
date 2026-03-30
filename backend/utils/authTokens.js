import crypto from "crypto";
import jwt from "jsonwebtoken";

export function createAccessToken(userId) {
  return jwt.sign(
    { id: userId },
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