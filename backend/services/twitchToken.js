let cachedToken = null;
let expiresAt = 0;

export async function getTwitchToken() {
  if (cachedToken && Date.now() < expiresAt) {
    return cachedToken;
  }

  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      grant_type: "client_credentials"
    })
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.message || "Failed to fetch Twitch token");
  }

  if (!data?.access_token || !Number.isFinite(data?.expires_in)) {
    throw new Error("Invalid Twitch token response");
  }

  cachedToken = data.access_token;
  expiresAt = Date.now() + Math.max(0, (data.expires_in - 60)) * 1000;

  console.log("Twitch token refreshed");

  return cachedToken;
}