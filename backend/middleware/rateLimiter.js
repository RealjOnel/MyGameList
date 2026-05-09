import rateLimit from "express-rate-limit";

const baseLimiterConfig = {
  standardHeaders: true,
  legacyHeaders: false
};

export const loginLimiter = rateLimit({
  ...baseLimiterConfig,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { message: "Too many login attempts, try again later." }
});

export const registerLimiter = rateLimit({
  ...baseLimiterConfig,
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { message: "Too many registration attempts, try again later." }
});

export const refreshLimiter = rateLimit({
  ...baseLimiterConfig,
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: { message: "Too many session refresh attempts, try again shortly." }
});

export const apiLimiter = rateLimit({
  ...baseLimiterConfig,
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  message: { message: "Too many requests, try again later." }
});

export const sendFriendRequestLimiter = rateLimit({
  ...baseLimiterConfig,
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 15,
  message: { message: "Too many friend requests sent, try again later." }
});

export const postCommentLimiter = rateLimit({
  ...baseLimiterConfig,
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: { message: "Too many comments posted, try again in a minute." }
});

export const reviewWriteLimiter = rateLimit({
  ...baseLimiterConfig,
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  message: {
    message: "Too many review changes. Please wait a few minutes before trying again."
  }
});

export const reviewReactionLimiter = rateLimit({
  ...baseLimiterConfig,
  windowMs: 2 * 60 * 1000, // 2 minutes
  max: 40,
  message: {
    message: "Too many review reactions. Please slow down for a moment."
  }
});

export const supportBugReportLimiter = rateLimit({
  ...baseLimiterConfig,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3,
  message: {
    message: "Too many bug reports. Please wait a bit before submitting another ticket."
  }
});