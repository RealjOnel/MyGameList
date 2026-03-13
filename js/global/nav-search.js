import { API_BASE_URL } from "../../backend/config.js";

const STORAGE_KEY = "navSearchMode";
const MODES = ["games", "users", "forum"];

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

  // apply variant changes AFTER append, BEFORE measuring last rect
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

    let mode = localStorage.getItem(STORAGE_KEY) || "games";
    if (!MODES.includes(mode)) mode = "games";
    root.dataset.mode = mode;
    setActiveTab(root, mode);
    updateModePlaceholder(root);

    if (modePicker) modePicker.hidden = false;
    if (hint) hint.textContent = "Enter = open full results";
  }
}

async function fetchGameSuggestions(q){
  const params = new URLSearchParams({
    page: "1",
    sort: "rating",
    order: "desc",
    search: q
  });

  const res = await fetch(`${API_BASE_URL}/api/igdb/games?${params.toString()}`);
  const games = await res.json();

  // keep it light
  return (Array.isArray(games) ? games : [])
    .filter(g => g?.cover?.image_id && g?.name)
    .slice(0, 15);
}

async function fetchUserSuggestions(q){
  const res = await fetch(
    `${API_BASE_URL}/api/users/search?q=${encodeURIComponent(q)}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    throw new Error("User search failed");
  }

  const data = await res.json();
  return Array.isArray(data?.users) ? data.users : [];
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
        const isExplore = !!document.getElementById("pageSearchSlot");
        const input = root.querySelector("#globalSearchInput");
        input.value = g.name;
        input.dispatchEvent(new Event("input", { bubbles: true }));

        if (!isExplore){
          const exploreHref = getExploreHref();
          const url = new URL(exploreHref, window.location.href);
          url.searchParams.set("search", g.name);
          window.location.href = url.toString();
        }

        root.querySelector(".nav-search-panel").hidden = true;
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

   // initial mode (nav defaults). variant switch can overwrite to "games"
  let mode = localStorage.getItem(STORAGE_KEY) || "games";
  if (!MODES.includes(mode)) mode = "games";
  root.dataset.mode = root.dataset.mode || mode;
  setActiveTab(root, root.dataset.mode);
  updateModePlaceholder(root);

  tabs.forEach(t => t.addEventListener("click", () => {
    const next = t.dataset.mode;
    root.dataset.mode = next;
    localStorage.setItem(STORAGE_KEY, next);
    setActiveTab(root, next);
    updateModePlaceholder(root);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }));

  if (modeBtn && modeMenu){
  modeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    modeMenu.hidden = !modeMenu.hidden;
  });

  modeOptions.forEach(btn => {
    btn.addEventListener("click", () => {
      const next = btn.dataset.mode;
      root.dataset.mode = next;
      localStorage.setItem(STORAGE_KEY, next);
      setActiveTab(root, next);
      updateModePlaceholder(root);
      modeMenu.hidden = true;
      input.focus();
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  });
}

  const run = debounce(async () => {
  // On Explore page: do not show dropdown or fetch suggestions
  if (root.dataset.variant === "page") {
    panel.hidden = true;
    return;
  }

  const modeNow = root.dataset.mode || "games";
  const q = input.value.trim();

  if (!q){
    renderSuggestions(root, modeNow, [], "");
    return;
  }

  try{
    if (modeNow === "games"){
      const items = await fetchGameSuggestions(q);
      renderSuggestions(root, modeNow, items, q);
    } else if (modeNow === "users"){
      const items = await fetchUserSuggestions(q);
      renderSuggestions(root, modeNow, items, q);
    } else {
      renderSuggestions(root, modeNow, [], q);
    }
  } catch {
    renderSuggestions(root, modeNow, [], q);
  }
}, 220);

  input.addEventListener("input", run);

  input.addEventListener("focus", () => {
  if (root.dataset.variant === "page") return; // no dropdown on explore
  if (input.value.trim()) panel.hidden = false;
});

  document.addEventListener("click", (e) => {
    if (!root.contains(e.target)) {
      panel.hidden = true;
      if (modeMenu) modeMenu.hidden = true;
    }
  });

  input.addEventListener("keydown", async (e) => {
    if (e.key === "Escape"){
      panel.hidden = true;
      input.blur();
      return;
    }
    if (e.key === "Enter"){
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

  const pageSlot = document.getElementById("pageSearchSlot"); // exists only on explore
  const existing = document.querySelector(".nav-search");
  const root = existing || buildSearch();

  if (!existing) setupSearch(root);

  const isExplore = !!pageSlot;
  const target = pageSlot || navSlot;

  // already mounted correctly, but variant might be wrong after bfcache/pageshow
  if (root.parentElement === target){
    setVariant(root, isExplore ? "page" : "nav");
    return;
  }

  // animate move + apply correct variant during FLIP
  moveWithFlip(root, target, () => setVariant(root, isExplore ? "page" : "nav"));
}

document.addEventListener("DOMContentLoaded", mountSearch);
window.addEventListener("pageshow", mountSearch);