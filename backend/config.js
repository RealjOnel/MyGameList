export const API_BASE_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:4000"
    : window.location.hostname.includes("beta")
      ? "https://mygamelist-beta.onrender.com"
      : "https://mygamelist-omhm.onrender.com";