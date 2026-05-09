import { API_BASE_URL } from "../../backend/config.js";

let refreshPromise = null;
let bootstrapPromise = null;
let accessToken = null;
let authState = "loading"; // "loading" | "in" | "out"

function safeParseJson(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

function applyAuthState() {
  document.documentElement.dataset.auth = authState;

  window.dispatchEvent(new CustomEvent("mgl:auth-state-changed", {
    detail: {
      state: authState,
      isAuthenticated: authState === "in"
    }
  }));
}

export function getAuthState() {
  return authState;
}

export function syncAuthState() {
  applyAuthState();
  return authState === "in";
}

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token) {
  accessToken = token || null;
  authState = accessToken ? "in" : "out";
  applyAuthState();
}

export function clearAccessToken() {
  accessToken = null;
  authState = "out";
  applyAuthState();
}

async function runRefresh() {
  const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: "POST",
    credentials: "include",
    cache: "no-store"
  });

  const text = await res.text();
  const data = safeParseJson(text);

  if (!res.ok || !data?.token) {
    clearAccessToken();
    return null;
  }

  setAccessToken(data.token);
  return data.token;
}

export async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = runRefresh()
      .catch((err) => {
        console.error("Refresh failed:", err);
        clearAccessToken();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export async function bootstrapAuth() {
  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  if (authState === "in" && accessToken) {
    return accessToken;
  }

  authState = "loading";
  applyAuthState();

  bootstrapPromise = refreshAccessToken()
    .finally(() => {
      if (!accessToken) {
        authState = "out";
        applyAuthState();
      }
      bootstrapPromise = null;
    });

  return bootstrapPromise;
}

export async function logout() {
  try {
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
      cache: "no-store"
    });
  } catch (err) {
    console.error("Logout request failed:", err);
  } finally {
    clearAccessToken();
  }
}

export async function fetchWithAuth(path, init = {}) {
  const url = /^https?:\/\//.test(path) ? path : `${API_BASE_URL}${path}`;

  let headers = new Headers(init.headers || {});
  const token = getAccessToken();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let res = await fetch(url, {
    ...init,
    headers,
    credentials: "include",
    cache: init.cache || "no-store"
  });

  if (res.status !== 401) {
    return res;
  }

  const newToken = await refreshAccessToken();
  if (!newToken) {
    return res;
  }

  headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${newToken}`);

  return fetch(url, {
    ...init,
    headers,
    credentials: "include",
    cache: init.cache || "no-store"
  });
}