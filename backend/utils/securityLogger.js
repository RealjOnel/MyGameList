export function getClientIp(req) {
  return (
    req.ip ||
    req.headers["x-forwarded-for"] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

export function getUserAgent(req) {
  return req.get("user-agent") || "unknown";
}

export function logSecurityEvent(event, details = {}) {
  const payload = {
    ts: new Date().toISOString(),
    event,
    ...details
  };

  console.log("[SECURITY]", JSON.stringify(payload));
}

export function logSecurityWarn(event, details = {}) {
  const payload = {
    ts: new Date().toISOString(),
    event,
    ...details
  };

  console.warn("[SECURITY]", JSON.stringify(payload));
}

export function logSecurityError(event, details = {}) {
  const payload = {
    ts: new Date().toISOString(),
    event,
    ...details
  };

  console.error("[SECURITY]", JSON.stringify(payload));
}