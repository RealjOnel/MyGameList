import { API_BASE_URL } from "../../backend/config.js";

export function syncAuthState() {
  const token = localStorage.getItem("token");
  document.documentElement.dataset.auth = token ? "in" : "out";
  return !!token;
}

export function getAccessToken() {
  return localStorage.getItem("token");
}

export function setAccessToken(token) {
  if (token) {
    localStorage.setItem("token", token);
  } else {
    localStorage.removeItem("token");
  }
  syncAuthState();
}

export function clearAccessToken() {
  localStorage.removeItem("token");
  syncAuthState();
}

export async function refreshAccessToken() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
      cache: "no-store"
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : {};

    if (!res.ok || !data?.token) {
      clearAccessToken();
      return null;
    }

    setAccessToken(data.token);
    return data.token;
  } catch (err) {
    console.error("Refresh failed:", err);
    clearAccessToken();
    return null;
  }
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