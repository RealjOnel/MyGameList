import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User } from "../models/user.js";

function getPayloadUserId(payload) {
  return payload?.id || payload?.userId || null;
}

function getPayloadTokenVersion(payload) {
  return Number(payload?.tokenVersion ?? -1);
}

export async function getOptionalUserId(req) {
  const authHeader = String(req.headers?.authorization || "").trim();
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }

  const userId = getPayloadUserId(payload);
  if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
    return null;
  }

  const user = await User.findById(userId).select("_id tokenVersion");
  if (!user || Number(user.tokenVersion || 0) !== getPayloadTokenVersion(payload)) {
    return null;
  }

  return String(user._id);
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Missing token" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const userId = getPayloadUserId(payload);
    const tokenVersion = getPayloadTokenVersion(payload);

    if (!userId) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    const user = await User.findById(userId).select("_id tokenVersion");

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (Number(user.tokenVersion || 0) !== tokenVersion) {
      return res.status(401).json({ message: "Session expired. Please log in again." });
    }

    req.userId = String(user._id);
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}