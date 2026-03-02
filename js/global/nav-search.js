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
  // Use the first navbar "Games" link as source of truth
  const a = document.querySelector('a[href*="../OtherPages/explore.html"]');
  return a?.getAttribute("href") || "../OtherPages/explore.html";
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

  // always close panel on mount/variant switch (prevents weird states)
  panel.hidden = true;

  if (variant === "page"){ // EXPLORE
    input.placeholder = "Search for games...";
    root.dataset.mode = "games";
    setActiveTab(root, "games");

    // hide tabs + make them unfocusable
    tabsWrap.hidden = true;
    tabsWrap.setAttribute("aria-hidden", "true");
    tabsWrap.querySelectorAll("button").forEach(b => (b.tabIndex = -1));

    if (hint) hint.textContent = "Enter = search";
  } else { // NAV
    input.placeholder = "Search games, users, forum...";

    tabsWrap.hidden = false;
    tabsWrap.removeAttribute("aria-hidden");
    tabsWrap.querySelectorAll("button").forEach(b => (b.tabIndex = 0));

    let mode = localStorage.getItem(STORAGE_KEY) || "games";
    if (!MODES.includes(mode)) mode = "games";
    root.dataset.mode = mode;
    setActiveTab(root, mode);

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

  if (mode !== "games"){
    state.textContent = "Coming soon";
    list.innerHTML = `
      <li class="nav-search-item" style="cursor:default;">
        <div class="nav-search-text">
          <div class="nav-search-title">${mode === "users" ? "User search" : "Forum search"} is not done yet</div>
          <div class="nav-search-sub">We do this later as we need the DB</div>
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
          <div class="nav-search-title">No games found</div>
          <div class="nav-search-sub">Try a different search term.</div>
        </div>
      </li>
    `;
    return;
  }

  state.textContent = `${items.length} results`;

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
      // If we are already on explore page, just fill and let explore.js react
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
}

function setActiveTab(root, mode){
  root.querySelectorAll(".nav-search-tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });
}

function setupSearch(root){
  const input = root.querySelector("#globalSearchInput");
  const panel = root.querySelector(".nav-search-panel");
  const tabs = root.querySelectorAll(".nav-search-tab");

   // initial mode (nav defaults). variant switch can overwrite to "games"
  let mode = localStorage.getItem(STORAGE_KEY) || "games";
  if (!MODES.includes(mode)) mode = "games";
  root.dataset.mode = root.dataset.mode || mode;
  setActiveTab(root, root.dataset.mode);

  tabs.forEach(t => t.addEventListener("click", () => {
    const next = t.dataset.mode;
    root.dataset.mode = next;
    localStorage.setItem(STORAGE_KEY, next);
    setActiveTab(root, next);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }));

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
    if (!root.contains(e.target)) panel.hidden = true;
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape"){
      panel.hidden = true;
      input.blur();
      return;
    }
    if (e.key === "Enter"){
      const q = input.value.trim();
      if (!q) return;

      // Enter => go to full results (explore page for now)
      const isExplore = !!document.getElementById("pageSearchSlot");
      if (isExplore){
        input.dispatchEvent(new Event("input", { bubbles: true }));
        panel.hidden = true;
      } else {
        const exploreHref = getExploreHref();
        const url = new URL(exploreHref, window.location.href);
        url.searchParams.set("search", q);
        window.location.href = url.toString();
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