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

  const data = await res.json();

  cachedToken = data.access_token;
  expiresAt = Date.now() + data.expires_in * 1000;

  console.log("🟣 Twitch Token refreshed");

  return cachedToken;
}