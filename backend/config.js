export const API_BASE_URL =
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:5500"
    : window.location.hostname.includes("beta")
      ? "https://mygamelist-beta.onrender.com"
      : "https://mygamelist-omhm.onrender.com";