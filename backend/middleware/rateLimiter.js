import rateLimit from "express-rate-limit";

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts, try again later." }
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many registration attempts, try again later." }
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many auth requests, try again later." }
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, try again later." }
});

export const sendFriendRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many friend requests sent, try again later." }
});

export const postCommentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many comments posted, try again in a minute." }
});

export const reviewWriteLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 2,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many review changes. Please wait a few minutes before trying again."
  }
});

export const reviewReactionLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many review reactions. Please slow down for a moment."
  }
});

// Rate Limit for all E-Mail related actions

export const supportBugReportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many bug reports. Please wait a bit before submitting another ticket."
  }
});