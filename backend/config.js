export const API_BASE_URL =
  window.location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:3000"
    : window.location.hostname === "localhost"
      ? "http://localhost:3000"
      : window.location.hostname.includes("beta")
        ? "https://mygamelist-beta.onrender.com"
        : "https://mygamelist-omhm.onrender.com";