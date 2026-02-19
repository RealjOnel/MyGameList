export const API_BASE_URL =
  window.location.hostname === "localhost"
    ? "http://127.0.0.1:5500/"
    : window.location.hostname.includes("beta")
      ? "https://mygamelist-beta.onrender.com"
      : "https://mygamelist-omhm.onrender.com";