import jwt from "jsonwebtoken";

function getPayloadUserId(payload) {
  return payload?.id || payload?.userId || null;
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Missing token" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const userId = getPayloadUserId(payload);

    if (!userId) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    req.userId = userId;
    next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}