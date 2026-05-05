import { fetchWithAuth, clearAccessToken, syncAuthState } from "./authClient.js";

const DEFAULT_COOKIE_PREFS = Object.freeze({
  preferences: true,
  analytics: false
});

/* Known non-essential local storage keys */
const PREFERENCE_STORAGE_KEYS = new Set([
  "mgl_nav_avatar_url"
]);

let cookiePrefsState = {
  ...DEFAULT_COOKIE_PREFS
};

function safeParseJson(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

function updateDocumentFlags() {
  document.documentElement.dataset.mglPreferenceCookies =
    cookiePrefsState.preferences ? "on" : "off";

  document.documentElement.dataset.mglAnalyticsCookies =
    cookiePrefsState.analytics ? "on" : "off";
}

export function registerPreferenceStorageKey(key) {
  if (!key) return;
  PREFERENCE_STORAGE_KEYS.add(String(key));
}

export function getCookiePreferencesState() {
  return { ...cookiePrefsState };
}

export function arePreferenceCookiesAllowed() {
  return cookiePrefsState.preferences !== false;
}

export function areAnalyticsCookiesAllowed() {
  return cookiePrefsState.analytics === true;
}

export function clearPreferenceStorage() {
  for (const key of PREFERENCE_STORAGE_KEYS) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
}

export function applyCookiePreferences(settings = {}) {
  const cookies = settings?.privacy?.cookies || {};

  cookiePrefsState = {
    preferences: cookies.preferences !== false,
    analytics: cookies.analytics === true
  };

  updateDocumentFlags();

  if (!cookiePrefsState.preferences) {
    clearPreferenceStorage();
  }

  return getCookiePreferencesState();
}

export async function bootstrapCookiePreferences() {
  updateDocumentFlags();

  const hasToken = syncAuthState();
  if (!hasToken) {
    cookiePrefsState = { ...DEFAULT_COOKIE_PREFS };
    updateDocumentFlags();
    return getCookiePreferencesState();
  }

  try {
    const res = await fetchWithAuth("/api/users/settings?_=" + Date.now(), {
      method: "GET"
    });

    if (res.status === 401) {
      clearAccessToken();
      cookiePrefsState = { ...DEFAULT_COOKIE_PREFS };
      updateDocumentFlags();
      return getCookiePreferencesState();
    }

    const text = await res.text();
    const data = safeParseJson(text);

    if (!res.ok) {
      throw new Error(data?.message || "Failed to load cookie preferences");
    }

    applyCookiePreferences(data?.settings || {});
    return getCookiePreferencesState();
  } catch (err) {
    console.error("Failed to bootstrap cookie preferences:", err);
    cookiePrefsState = { ...DEFAULT_COOKIE_PREFS };
    updateDocumentFlags();
    return getCookiePreferencesState();
  }
}

export function preferenceStorageGetItem(key) {
  if (!arePreferenceCookiesAllowed()) return null;
  return localStorage.getItem(key);
}

export function preferenceStorageSetItem(key, value) {
  if (!arePreferenceCookiesAllowed()) return;
  localStorage.setItem(key, value);
}

export function preferenceStorageRemoveItem(key) {
  localStorage.removeItem(key);
}

export function preferenceSessionGetItem(key) {
  if (!arePreferenceCookiesAllowed()) return null;
  return sessionStorage.getItem(key);
}

export function preferenceSessionSetItem(key, value) {
  if (!arePreferenceCookiesAllowed()) return;
  sessionStorage.setItem(key, value);
}

export function preferenceSessionRemoveItem(key) {
  sessionStorage.removeItem(key);
}