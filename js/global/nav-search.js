import { API_BASE_URL } from "../../backend/config.js";
import { fetchWithAuth, clearAccessToken, getAccessToken, bootstrapAuth } from "./authClient.js";
import { bootstrapCookiePreferences, preferenceStorageGetItem, preferenceStorageSetItem } from "./privacyPreferences.js";

const STORAGE_KEY = "navSearchMode";
const MODES = ["games", "users", "forum"];

const DEFAULT_CUSTOMIZATION = Object.freeze({
  defaultExploreView: "grid",
  compactInterface: false,
  reducedMotion: false,
  liveSearchSuggestions: true
});

const SEARCH_DEBOUNCE_MS = 180;
const MIN_QUERY_LENGTH = 2;
const GAME_SUGGESTION_LIMIT = 10;
const USER_SUGGESTION_LIMIT = 8;
const SUGGESTION_CACHE_MAX = 40;

const suggestionCache = {
  games: new Map(),
  users: new Map()
};

function normalizeQueryKey(q = "") {
  return String(q).trim().toLowerCase();
}

function getCachedSuggestions(mode, q) {
  const key = normalizeQueryKey(q);
  if (!key) return null;
  return suggestionCache[mode]?.get(key) || null;
}

function setCachedSuggestions(mode, q, items) {
  const key = normalizeQueryKey(q);
  if (!key || !suggestionCache[mode]) return;

  const bucket = suggestionCache[mode];

  if (bucket.has(key)) {
    bucket.delete(key);
  }

  bucket.set(key, items);

  if (bucket.size > SUGGESTION_CACHE_MAX) {
    const oldestKey = bucket.keys().next().value;
    bucket.delete(oldestKey);
  }
}

function normalizeCustomization(raw = {}) {
  return {
    defaultExploreView: ["grid", "compact", "table"].includes(raw?.defaultExploreView)
      ? raw.defaultExploreView
      : "grid",
    compactInterface: Boolean(raw?.compactInterface),
    reducedMotion: Boolean(raw?.reducedMotion),
    liveSearchSuggestions: raw?.liveSearchSuggestions !== false
  };
}

function liveSearchSuggestionsEnabled() {
  return document.documentElement.dataset.liveSearch !== "false";
}

function applyCustomization(customizationRaw = {}) {
  const customization = normalizeCustomization(customizationRaw);
  const root = document.documentElement;

  root.dataset.defaultExploreView = customization.defaultExploreView;
  root.dataset.compactUi = customization.compactInterface ? "true" : "false";
  root.dataset.reducedMotion = customization.reducedMotion ? "true" : "false";
  root.dataset.liveSearch = customization.liveSearchSuggestions ? "true" : "false";

  window.mglCustomization = customization;

  window.dispatchEvent(
    new CustomEvent("mgl:customization-applied", {
      detail: { customization }
    })
  );

  return customization;
}

async function apiAuth(path, { method = "GET", body } = {}) {
  const finalPath =
    method === "GET"
      ? `${path}${path.includes("?") ? "&" : "?"}_=${Date.now()}`
      : path;

  const headers = {};
  if (body) headers["Content-Type"] = "application/json";

  const res = await fetchWithAuth(finalPath, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (res.status === 401) {
    clearAccessToken();
    throw new Error("SESSION_EXPIRED");
  }

  if (!res.ok) {
    throw new Error(data?.message || `Request failed (${res.status})`);
  }

  return data;
}

async function loadCustomizationSettings() {
  if (!getAccessToken()) {
    return applyCustomization();
  }

  try {
    const data = await apiAuth("/api/users/settings");
    return applyCustomization(data?.settings?.customization);
  } catch (err) {
    if (err.message === "SESSION_EXPIRED") {
      return applyCustomization();
    }

    console.error("Failed to load customization settings", err);
    return applyCustomization();
  }
}

function debounce(fn, ms){
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/** FLIP animation for moving element between mounts */
function moveWithFlip(el, newParent, afterAppend){
  const first = el.getBoundingClientRect();
  newParent.appendChild(el);

  if (typeof afterAppend === "function") afterAppend();

  const last = el.getBoundingClientRect();

  const dx = first.left - last.left;
  const dy = first.top - last.top;
  const sx = first.width / last.width;
  const sy = first.height / last.height;

  el.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
      { transform: "none" }
    ],
    { duration: 420, easing: "cubic-bezier(.22,1,.36,1)" }
  );
}

function getExploreHref(){
  const a = document.querySelector('a[href*="explore.html"]');
  return a?.getAttribute("href") || "./OtherPages/explore.html";
}

function getGameHref(gameId){
  const path = window.location.pathname.replace(/\\/g, "/");
  let base;
  if (path.includes("/gamepage/")) {
    base = "./game.html";
  } else if (path.includes("/OtherPages/") || path.includes("/profile/")) {
    base = "../gamepage/game.html";
  } else {
    base = "gamepage/game.html";
  }

  const url = new URL(base, window.location.href);
  url.searchParams.set("id", String(gameId));
  return url.toString();
}

function getProfileHref(username = ""){
  const a = document.querySelector('#userDropdown a[href*="profile.html"], a[href*="profile.html"]');
  const base = a?.getAttribute("href") || "./profile/profile.html";
  const url = new URL(base, window.location.href);

  if (username) {
    url.searchParams.set("username", username);
  }

  return url.toString();
}

function getDefaultAvatarUrl(){
  return `${window.location.origin}/assets/User/Default_User_Icon.png`;
}

function buildSearch(){
  const root = document.createElement("div");
  root.className = "nav-search";
  root.innerHTML = `
    <div class="nav-search-input">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M21 21l-4.3-4.3m1.3-5.4a7.4 7.4 0 11-14.8 0 7.4 7.4 0 0114.8 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>

      <input id="globalSearchInput" class="nav-search-field" type="text"
       placeholder="Search games, users, forum..." autocomplete="off" />

      <div class="nav-search-mode-picker">
        <button class="nav-search-mode-btn" type="button" aria-label="Choose search mode">
          <i class="fa-solid fa-sliders"></i>
        </button>

        <div class="nav-search-mode-menu" hidden>
          <button class="nav-search-mode-option" data-mode="games" type="button">
            <i class="fa-solid fa-gamepad"></i>
            <span>Games</span>
          </button>
          <button class="nav-search-mode-option" data-mode="users" type="button">
            <i class="fa-solid fa-user"></i>
            <span>Users</span>
          </button>
          <button class="nav-search-mode-option" data-mode="forum" type="button">
            <i class="fa-solid fa-comments"></i>
            <span>Forum</span>
          </button>
        </div>
      </div>
    </div>

    <div class="nav-search-panel" hidden>
      <div class="nav-search-tabs">
        <button class="nav-search-tab" data-mode="games" type="button">Games</button>
        <button class="nav-search-tab" data-mode="users" type="button">Users</button>
        <button class="nav-search-tab" data-mode="forum" type="button">Forum</button>
      </div>

      <ul class="nav-search-results"></ul>

      <div class="nav-search-footer">
        <span class="nav-search-hint">Enter = open full results</span>
        <span class="nav-search-state"></span>
      </div>
    </div>
  `;
  return root;
}

function setVariant(root, variant){
  root.dataset.variant = variant;

  const input = root.querySelector("#globalSearchInput");
  const tabsWrap = root.querySelector(".nav-search-tabs");
  const hint = root.querySelector(".nav-search-hint");
  const panel = root.querySelector(".nav-search-panel");
  const modePicker = root.querySelector(".nav-search-mode-picker");
  const modeMenu = root.querySelector(".nav-search-mode-menu");

  panel.hidden = true;
  if (modeMenu) modeMenu.hidden = true;

  if (variant === "page"){
    root.dataset.mode = "games";
    setActiveTab(root, "games");
    updateModePlaceholder(root);

    tabsWrap.hidden = true;
    tabsWrap.setAttribute("aria-hidden", "true");
    tabsWrap.querySelectorAll("button").forEach(b => (b.tabIndex = -1));

    if (modePicker) modePicker.hidden = true;
    if (hint) hint.textContent = "Enter = search";
  } else {
    tabsWrap.hidden = false;
    tabsWrap.removeAttribute("aria-hidden");
    tabsWrap.querySelectorAll("button").forEach(b => (b.tabIndex = 0));

    let mode = preferenceStorageGetItem(STORAGE_KEY) || "games";
    if (!MODES.includes(mode)) mode = "games";
    root.dataset.mode = mode;
    setActiveTab(root, mode);
    updateModePlaceholder(root);

    if (modePicker) modePicker.hidden = false;
    if (hint) hint.textContent = liveSearchSuggestionsEnabled() ? "Enter = open full results" : "Enter = search";
  }
}

async function fetchGameSuggestions(q, signal){
  const cached = getCachedSuggestions("games", q);
  if (cached) return cached;

  const res = await fetch(
    `${API_BASE_URL}/api/igdb/search-suggestions?q=${encodeURIComponent(q)}&limit=${GAME_SUGGESTION_LIMIT}`,
    {
      cache: "no-store",
      signal
    }
  );

  if (!res.ok) {
    throw new Error("Game search failed");
  }

  const games = await res.json();
  const items = Array.isArray(games) ? games : [];

  setCachedSuggestions("games", q, items);
  return items;
}

async function fetchUserSuggestions(q, signal) {
  const cached = getCachedSuggestions("users", q);
  if (cached) return cached;

  const res = await fetch(
    `${API_BASE_URL}/api/users/search?q=${encodeURIComponent(q)}&limit=${USER_SUGGESTION_LIMIT}`,
    {
      cache: "no-store",
      signal
    }
  );

  if (!res.ok) {
    throw new Error("User search failed");
  }

  const data = await res.json();
  const items = Array.isArray(data?.users) ? data.users : [];

  setCachedSuggestions("users", q, items);
  return items;
}

function renderSuggestions(root, mode, items, q){
  const panel = root.querySelector(".nav-search-panel");
  const list = root.querySelector(".nav-search-results");
  const state = root.querySelector(".nav-search-state");

  list.innerHTML = "";

  if (!q){
    state.textContent = "";
    panel.hidden = true;
    return;
  }

  panel.hidden = false;

  if (mode === "forum"){
    state.textContent = "Coming soon";
    list.innerHTML = `
      <li class="nav-search-item" style="cursor:default;">
        <div class="nav-search-text">
          <div class="nav-search-title">Forum search is not done yet</div>
          <div class="nav-search-sub">We do this later.</div>
        </div>
      </li>
    `;
    return;
  }

  if (!items.length){
    state.textContent = "No matches";
    list.innerHTML = `
      <li class="nav-search-item" style="cursor:default;">
        <div class="nav-search-text">
          <div class="nav-search-title">No ${mode} found</div>
          <div class="nav-search-sub">Try a different search term.</div>
        </div>
      </li>
    `;
    return;
  }

  state.textContent = `${items.length} results`;

  if (mode === "games"){
    for (const g of items){
      const img = `https://images.igdb.com/igdb/image/upload/t_cover_small/${g.cover.image_id}.jpg`;
      const genre = g?.genres?.[0]?.name || "Unknown Genre";
      const studio =
        g?.involved_companies?.find(c => c?.developer)?.company?.name ||
        g?.involved_companies?.find(c => c?.publisher)?.company?.name ||
        "Unknown Studio";

      const li = document.createElement("li");
      li.className = "nav-search-item";
      li.innerHTML = `
        <div class="nav-search-thumb"><img src="${img}" alt=""></div>
        <div class="nav-search-text">
          <div class="nav-search-title">${g.name}</div>
          <div class="nav-search-sub">${genre} • ${studio}</div>
        </div>
      `;

      li.addEventListener("click", () => {
        root.querySelector(".nav-search-panel").hidden = true;
        window.location.href = getGameHref(g.id);
      });

      list.appendChild(li);
    }

    return;
  }

  if (mode === "users"){
    for (const user of items){
      const li = document.createElement("li");
      li.className = "nav-search-item";

      const avatar = user.avatarUrl || getDefaultAvatarUrl();

      li.innerHTML = `
        <div class="nav-search-thumb nav-search-thumb--user">
          <img src="${avatar}" alt="${user.username || "User"}">
        </div>
        <div class="nav-search-text">
          <div class="nav-search-title">${user.username}</div>
          <div class="nav-search-sub">Open profile</div>
        </div>
      `;

      li.addEventListener("click", () => {
        window.location.href = getProfileHref(user.username);
      });

      list.appendChild(li);
    }

    return;
  }
}

function setActiveTab(root, mode){
  root.querySelectorAll(".nav-search-tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });
}

function updateModePlaceholder(root){
  const input = root.querySelector("#globalSearchInput");
  const mode = root.dataset.mode || "games";

  if (root.dataset.variant === "page"){
    input.placeholder = "Search for games...";
    return;
  }

  if (mode === "games") input.placeholder = "Search games...";
  else if (mode === "users") input.placeholder = "Search users...";
  else if (mode === "forum") input.placeholder = "Search forum...";
  else input.placeholder = "Search games, users, forum...";
}

function setupSearch(root){
  const input = root.querySelector("#globalSearchInput");
  const panel = root.querySelector(".nav-search-panel");
  const tabs = root.querySelectorAll(".nav-search-tab");
  const modeBtn = root.querySelector(".nav-search-mode-btn");
  const modeMenu = root.querySelector(".nav-search-mode-menu");
  const modeOptions = root.querySelectorAll(".nav-search-mode-option");
  const stateEl = root.querySelector(".nav-search-state");

  const requestState = {
    controller: null,
    requestId: 0
  };

  function cancelActiveSearch() {
    if (requestState.controller) {
      requestState.controller.abort();
      requestState.controller = null;
    }
  }

  let mode = preferenceStorageGetItem(STORAGE_KEY) || "games";
  if (!MODES.includes(mode)) mode = "games";
  root.dataset.mode = root.dataset.mode || mode;
  setActiveTab(root, root.dataset.mode);
  updateModePlaceholder(root);

  tabs.forEach(t => t.addEventListener("click", () => {
    const next = t.dataset.mode;
    root.dataset.mode = next;
    preferenceStorageSetItem(STORAGE_KEY, next);
    setActiveTab(root, next);
    updateModePlaceholder(root);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }));

  if (modeBtn && modeMenu){
    modeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      panel.hidden = true;
      modeMenu.hidden = !modeMenu.hidden;
    });

    input.addEventListener("focus", () => {
      if (modeMenu) modeMenu.hidden = true;
      if (root.dataset.variant === "page") return;
      if (input.value.trim()) panel.hidden = false;
    });

    modeOptions.forEach(btn => {
      btn.addEventListener("click", () => {
        const next = btn.dataset.mode;
        root.dataset.mode = next;
        preferenceStorageSetItem(STORAGE_KEY, next);
        setActiveTab(root, next);
        updateModePlaceholder(root);
        modeMenu.hidden = true;
        input.focus();
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    });
  }

  const run = debounce(async () => {
    if (root.dataset.variant === "page") {
      panel.hidden = true;
      return;
    }

    if (!liveSearchSuggestionsEnabled()) {
      panel.hidden = true;
      return;
    }

    const modeNow = root.dataset.mode || "games";
    const q = input.value.trim();
    const currentRequestId = ++requestState.requestId;

    cancelActiveSearch();

    if (!q || q.length < MIN_QUERY_LENGTH) {
      renderSuggestions(root, modeNow, [], "");
      return;
    }

    const cached = getCachedSuggestions(modeNow, q);
    if (cached) {
      renderSuggestions(root, modeNow, cached, q);
      return;
    }

    const controller = new AbortController();
    requestState.controller = controller;

    panel.hidden = false;
    if (stateEl) stateEl.textContent = "Searching...";

    try {
      let items = [];

      if (modeNow === "games") {
        items = await fetchGameSuggestions(q, controller.signal);
      } else if (modeNow === "users") {
        items = await fetchUserSuggestions(q, controller.signal);
      } else {
        items = [];
      }

      if (controller.signal.aborted) return;
      if (currentRequestId !== requestState.requestId) return;

      renderSuggestions(root, modeNow, items, q);
    } catch (err) {
      if (err?.name === "AbortError") return;
      if (currentRequestId !== requestState.requestId) return;

      console.error("Nav search failed:", err);
      renderSuggestions(root, modeNow, [], q);
    } finally {
      if (requestState.controller === controller) {
        requestState.controller = null;
      }
    }
  }, SEARCH_DEBOUNCE_MS);

  input.addEventListener("input", run);

  input.addEventListener("focus", () => {
    if (root.dataset.variant === "page") return;
    if (!liveSearchSuggestionsEnabled()) return;
    if (input.value.trim().length >= MIN_QUERY_LENGTH) panel.hidden = false;
  });

  document.addEventListener("click", (e) => {
    if (!root.contains(e.target)) {
      cancelActiveSearch();
      panel.hidden = true;
      if (modeMenu) modeMenu.hidden = true;
    }
  });

  input.addEventListener("keydown", async (e) => {
    if (e.key === "Escape"){
      cancelActiveSearch();
      panel.hidden = true;
      input.blur();
      return;
    }

    if (e.key === "Enter"){
      cancelActiveSearch();

      const q = input.value.trim();
      if (!q) return;

      const modeNow = root.dataset.mode || "games";
      const isExplore = !!document.getElementById("pageSearchSlot");

      if (modeNow === "games"){
        if (isExplore){
          input.dispatchEvent(new Event("input", { bubbles: true }));
          panel.hidden = true;
        } else {
          const exploreHref = getExploreHref();
          const url = new URL(exploreHref, window.location.href);
          url.searchParams.set("search", q);
          window.location.href = url.toString();
        }
        return;
      }

      if (modeNow === "users"){
        try {
          const users = await fetchUserSuggestions(q);
          if (users.length) {
            window.location.href = getProfileHref(users[0].username);
          }
        } catch (err) {
          console.error(err);
        }
        return;
      }
    }
  });
}

function mountSearch(){
  const navSlot = document.getElementById("navSearchSlot");
  if (!navSlot) return;

  const pageSlot = document.getElementById("pageSearchSlot");
  const existing = document.querySelector(".nav-search");
  const isExplore = !!pageSlot;
  const target = pageSlot || navSlot;

  if (!existing){
    const root = buildSearch();
    setupSearch(root);
    target.appendChild(root);
    setVariant(root, isExplore ? "page" : "nav");
    return;
  }

  const root = existing;

  if (root.parentElement === target){
    setVariant(root, isExplore ? "page" : "nav");
    return;
  }

  moveWithFlip(root, target, () => setVariant(root, isExplore ? "page" : "nav"));
}

document.addEventListener("DOMContentLoaded", mountSearch);
window.addEventListener("pageshow", mountSearch);

document.addEventListener("DOMContentLoaded", async () => {
  await bootstrapCookiePreferences();

  loadCustomizationSettings().catch((err) => {
    console.error("Customization init failed", err);
  });
});

window.addEventListener("mgl:settings-saved", (e) => {
  applyCustomization(e.detail?.settings?.customization);

  document.querySelectorAll(".nav-search-panel").forEach((panel) => {
    panel.hidden = true;
  });

  document.querySelectorAll(".nav-search").forEach((root) => {
    const hint = root.querySelector(".nav-search-hint");
    if (!hint) return;

    hint.textContent =
      root.dataset.variant === "page" || !liveSearchSuggestionsEnabled()
        ? "Enter = search"
        : "Enter = open full results";
  });
});