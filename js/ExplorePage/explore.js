import { API_BASE_URL } from "../../backend/config.js";
const gameGrid = document.getElementById("gameGrid");
const sentinel = document.getElementById("infiniteSentinel");
const loaderEl = document.getElementById("infiniteLoader");
const endEl = document.getElementById("endOfList");

const URL_SEARCH = (new URLSearchParams(window.location.search).get("search") || "").trim();
let bootSearch = URL_SEARCH;

function getSearchInput(){
  return document.getElementById("globalSearchInput") || document.querySelector(".search-input");
}

function getSearchQuery(){
  const el = getSearchInput();
  const v = el?.value?.trim();
  return v || bootSearch || "";
}

// When the input finally exists, reflect URL search in it (nice UX)
document.addEventListener("DOMContentLoaded", () => {
  const el = getSearchInput();
  if (el && bootSearch && !el.value) el.value = bootSearch;
});

const PAGE_SIZE = 50; // HAS to be the same as the limit on IGDB.js
let hasMore = true;
let observer = null;

let currentPage = 1;
let isLoading = false;
// Default sort: highest rated games first (as a popularity proxy)
let sortBy = "rating";
let sortOrder = "desc";
let selectedGenre = "all";
let selectedPlatform = "all";



const bannedPatterns = [
  /collector/i,
  /collector's/i,
  /soundtrack/i,
  /artbook/i,
  /case/i,
  /steelbook/i,
  /special/i,
  /figurine/i,
  /statue/i,
  /\bpack\b/i,
  /\bbundle\b/i,
  /\bdlc\b/i,
  /character pack/i,
  /100%\s*orange juice/i,
  /\bseason pass\b/i,
  /\bgame of the year\b/i,
  /\bgoty\b/i,
  /\bultimate( edition)\b/i,
  /\bcomplete( edition)?\b/i,
  /\bdefinitive( edition)?\b/i,
  /\bdeluxe( edition)?\b/i,
  /\bpremium( edition)?\b/i,
];

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[m]));
}

// Load more function

function setLoadingUI(on){
  if (!loaderEl) return;

  // when there is no more games, the load more box is hidden
  if (!hasMore) on = false;

  loaderEl.hidden = !on;
  loaderEl.setAttribute("aria-busy", on ? "true" : "false");
}

function setEndUI(on){
  if (endEl) endEl.hidden = !on;
}

const THEME_COLORS = {
  // Default Brand
  mgl:      { base: "255,255,255", stripeA: "59,130,246", stripeB: "168,85,247" },

  // Brands
  nintendo: { base: "255,60,60",   stripeA: "255,60,60",   stripeB: "255,60,60" },
  sony:     { base: "90,140,255",  stripeA: "90,140,255",  stripeB: "90,140,255" },
  microsoft:{ base: "0,255,140",   stripeA: "0,255,140",   stripeB: "0,255,140" },
  sega:     { base: "0,190,255",   stripeA: "0,190,255",   stripeB: "0,190,255" },
  pc:       { base: "200,200,220", stripeA: "200,200,220", stripeB: "200,200,220" },
  mobile:   { base: "0,225,190",   stripeA: "0,225,190",   stripeB: "0,225,190" },
  vr:       { base: "168,85,247",  stripeA: "168,85,247",  stripeB: "168,85,247" },
  other:    { base: "148,163,184", stripeA: "148,163,184", stripeB: "148,163,184" },
};

function applyBgVars(svg, fromTheme, toTheme){
  const from = THEME_COLORS[fromTheme] || THEME_COLORS.mgl;
  const to   = THEME_COLORS[toTheme]   || THEME_COLORS.mgl;

  svg.style.setProperty("--base-old", from.base);
  svg.style.setProperty("--base-new", to.base);

  svg.style.setProperty("--stripeA-old", from.stripeA);
  svg.style.setProperty("--stripeB-old", from.stripeB);

  svg.style.setProperty("--stripeA-new", to.stripeA);
  svg.style.setProperty("--stripeB-new", to.stripeB);
}

function initBgTints(){
  const root = document.documentElement;
  const svg = document.querySelector(".theme-bg");
  if (!svg) return;

  if (!root.dataset.theme || root.dataset.theme === "neutral") {
    root.dataset.theme = "mgl";
  }

  applyBgVars(svg, root.dataset.theme, root.dataset.theme);
}

document.addEventListener("DOMContentLoaded", initBgTints);

function setThemeWithWipe(nextTheme) {
  const root = document.documentElement;
  const svg = document.querySelector(".theme-bg");

  if (!svg) {
    root.dataset.theme = nextTheme;
    return;
  }

  const currentTheme = root.dataset.theme || "mgl";
  if (currentTheme === nextTheme) return;

  // prepare variables
  applyBgVars(svg, currentTheme, nextTheme);

  // Theme set
  root.dataset.theme = nextTheme;

  // start wipe
  svg.classList.remove("is-wiping");
  void svg.getBoundingClientRect();
  svg.classList.add("is-wiping");

  // after wipe: stabilize
  setTimeout(() => {
    svg.classList.remove("is-wiping");
    applyBgVars(svg, nextTheme, nextTheme);
  }, 700);
}

function platformKeyToTheme(key){
  const map = {
    // Sony
    ps1:"sony", ps2:"sony", ps3:"sony", ps4:"sony", ps5:"sony", psp:"sony", psvita:"sony", psvr:"sony",

    // Microsoft
    xbox:"microsoft", xbox360:"microsoft", xboxone:"microsoft", xboxseries:"microsoft",

    // Nintendo
    switch:"nintendo", switch2:"nintendo", wii:"nintendo", wiiu:"nintendo", n64:"nintendo", gcn:"nintendo",
    virtualboy:"nintendo", nes:"nintendo", snes:"nintendo", ds:"nintendo", n3ds:"nintendo", gba:"nintendo", gbc:"nintendo", gb:"nintendo",

    // Sega
    dreamcast:"sega", saturn:"sega", sega32x:"sega", segacd:"sega", megadrive:"sega", gamegear:"sega", mastersystem:"sega", sg1000:"sega", pico:"sega", nomad:"sega",

    // PC/Web
    windows:"pc", linux:"pc", webbrowser:"pc",

    // Mobile
    mobile:"mobile",

    // VR
    steamvr:"vr", oculusvr:"vr", metaquest:"vr",

    // Other
    amiga:"other", cpc:"other"
  };
  return map[key] || "mgl";
}

function computeTheme(){
  // Chose Plattform => Brand Theme
  if (selectedPlatform && selectedPlatform !== "all"){
    return platformKeyToTheme(selectedPlatform);
  }
  // Default => MyGameList
  return "mgl";
}

function isRealGame(game) {
  if (!game?.name) return false;
  if (!game.cover) return false;

  // Use category only to filter out obvious DLC / expansions / episodes etc.
  // IGDB categories (relevant ones):
  // 0 = main game
  // 1 = dlc/add-on
  // 2 = expansion
  // 3 = bundle
  // 4 = standalone expansion
  // 5 = mod
  // 6 = episode
  // 7 = season
  // 8 = remake
  // 9 = remaster
  // 10 = expanded game
  // 11 = port
  // 12 = fork

  // We only *exclude* the clearly non-main content categories if present;
  // if category is missing/unknown, we keep the game.
  const dlcLikeCategories = new Set([1, 2, 3, 4, 5, 6, 7]);
  const cat = game.category;
  if (dlcLikeCategories.has(cat)) return false;

  // Finally, drop anything whose name clearly looks like an edition / pack.
  return !bannedPatterns.some((rx) => rx.test(game.name));
}

function getOriginalPlatformName(game) {
  const rds = game.release_dates || [];
  if (!Array.isArray(rds) || rds.length === 0) return null;

  // only entries with a platform
  const usable = rds
    .filter(r => r?.platform?.name)
    .map(r => ({
      name: r.platform.name,
      date: typeof r.date === "number" ? r.date : Infinity
    }));

  if (usable.length === 0) return null;

  // if we have date values: pick the earliest
  const withDates = usable.filter(x => x.date !== Infinity);
  if (withDates.length > 0) {
    withDates.sort((a, b) => a.date - b.date);
    return withDates[0].name;
  }

  // fallback: if IGDB doesnt give dates
  return usable[0].name;
}

function platformToIconInfo(platformName) {
  if (!platformName) return null;
  const p = platformName.toLowerCase();

  // SONY
  if (p.includes("playstation vr2") || p.includes("playstation vr 2") || p.includes("ps vr2") || p.includes("psvr2") || p.includes("ps vr 2") || /\bps\s*vr\s*2\b/.test(p) || /\bpsvr\s*2\b/.test(p) || p.includes("playstation vr") || p.includes("ps vr") || p.includes("psvr") || /\bps\s*vr\b/.test(p) || /\bpsvr\b/.test(p)) return { src: "../assets/platforms/sony/psvr.svg", brand: "sony", key: "psvr" };
  if (p.includes("playstation vita") || p.includes("ps vita") || p.includes("psvita")) return { src: "../assets/platforms/sony/psvita.svg", brand: "sony" };
  if (p.includes("playstation portable") || p.includes("psp")) return { src: "../assets/platforms/sony/psp.svg", brand: "sony" };
  if (p.includes("playstation 5") || p.includes("ps5")) return { src: "../assets/platforms/sony/ps5.svg", brand: "sony" };
  if (p.includes("playstation 4") || p.includes("ps4")) return { src: "../assets/platforms/sony/ps4.svg", brand: "sony", key: "ps4" };
  if (p.includes("playstation 3") || p.includes("ps3")) return { src: "../assets/platforms/sony/ps3.svg", brand: "sony" };
  if (p.includes("playstation 2") || p.includes("ps2")) return { src: "../assets/platforms/sony/ps2.svg", brand: "sony", key:"ps2" };
  if (p.includes("playstation") || p.includes("ps1") || p.includes("psx")) return { src: "../assets/platforms/sony/ps1.svg", brand: "sony", key: "ps1"};

  // MICROSOFT
  if (p.includes("xbox series") || p.includes("series x") || p.includes("series s")) return { src: "../assets/platforms/microsoft/xboxseries.svg", brand: "microsoft" };
  if (p.includes("xbox one")) return { src: "../assets/platforms/microsoft/xboxone.svg", brand: "microsoft" };
  if (p.includes("xbox 360")) return { src: "../assets/platforms/microsoft/xbox360.svg", brand: "microsoft" };
  if (p.includes("xbox")) return { src: "../assets/platforms/microsoft/xbox.svg", brand: "microsoft" };

  // SEGA
  if (p.includes("sega sg-1000") || p.includes("sg-1000") || p.includes("sg1000")) return { src: "../assets/platforms/sega/sg1000.svg", brand: "sega", key: "sg1000" };
  if (p.includes("sega master system") || p.includes("master system") || p.includes("sega mark iii") || p.includes("mark iii")) return { src: "../assets/platforms/sega/mastersystem.svg", brand: "sega", key: "mastersystem" };
  if (p.includes("game gear") || p.includes("sega game gear")) return { src: "../assets/platforms/sega/gamegear.svg", brand: "sega", key: "gamegear" };
  if (p.includes("sega genesis") || p.includes("genesis") || p.includes("sega mega drive") || p.includes("mega drive") || p.includes("megadrive")) return { src: "../assets/platforms/sega/megadrive.svg", brand: "sega", key: "megadrive" };
  if (p.includes("sega cd") || (p.includes("mega") && p.includes("cd")) || p.includes("mega-cd") || p.includes("megacd")) return { src: "../assets/platforms/sega/segacd.svg", brand: "sega", key: "segacd" };
  if (p.includes("32x") || p.includes("sega 32x")) return { src: "../assets/platforms/sega/sega32x.svg", brand: "sega", key: "sega32x" };
  if (p.includes("sega saturn") || p.includes("saturn")) return { src: "../assets/platforms/sega/saturn.svg", brand: "sega", key: "saturn" };
  if (p.includes("dreamcast") || p.includes("sega dreamcast")) return { src: "../assets/platforms/sega/dreamcast.svg", brand: "sega", key: "dreamcast" };
  if (p.includes("sega pico") || /\bpico\b/.test(p)) return { src: "../assets/platforms/sega/pico.png", brand: "sega", key: "pico" };
  if (p.includes("sega nomad") || /\bnomad\b/.test(p)) return { src: "../assets/platforms/sega/nomad.svg", brand: "sega", key: "nomad" };

  // NINTENDO
  if (p.includes("nintendo switch 2") || /\bswitch\s*2\b/.test(p) || p.includes("switch2")) return { src: "../assets/platforms/nintendo/switch2.svg", brand: "nintendo", key: "switch2" };
  if (p.includes("switch") || /\bswitch\s*1\b/.test(p)) return { src: "../assets/platforms/nintendo/switch1.svg", brand: "nintendo" };
  if (p.includes("wii u")) return { src: "../assets/platforms/nintendo/wiiu.svg", brand: "nintendo" };
  if (p.includes("wii")) return { src: "../assets/platforms/nintendo/wii.svg", brand: "nintendo" };
  if (p.includes("virtual boy")) return { src: "../assets/platforms/nintendo/virtualboy.svg", brand: "nintendo" };
  if (p.includes("nintendo 64") || p.includes("n64")) return { src: "../assets/platforms/nintendo/n64.svg", brand: "nintendo" };
  if (p.includes("gamecube")) return { src: "../assets/platforms/nintendo/gcn.svg", brand: "nintendo" };
  if (p.includes("super nintendo") || /\bsnes\b/.test(p) || p.includes("super famicom")) return { src: "../assets/platforms/nintendo/snes.svg", brand: "nintendo", key: "snes" };
  if ((p.includes("nintendo entertainment system") || /\bnes\b/.test(p) || (p.includes("famicom") && !p.includes("super famicom")) || p.includes("family computer")) && !(p.includes("super nintendo") || /\bsnes\b/.test(p) || p.includes("super famicom"))) return { src: "../assets/platforms/nintendo/nes.svg", brand: "nintendo", key: "nes" };
  if (p.includes("game boy advance") || p.includes("gba")) return { src: "../assets/platforms/nintendo/gba.svg", brand: "nintendo" };
  if (p.includes("game boy color") || p.includes("gbc")) return { src: "../assets/platforms/nintendo/gbcolor.svg", brand: "nintendo" };
  if (p.includes("game boy")) return { src: "../assets/platforms/nintendo/gameboy.svg", brand: "nintendo" };
  if (p.includes("nintendo ds") || p.includes("nds") || p === "ds") return { src: "../assets/platforms/nintendo/ds.svg", brand: "nintendo" };
  if (p.includes("nintendo 3ds") || p.includes("3ds")) return { src: "../assets/platforms/nintendo/3ds.svg", brand: "nintendo" };

  // MOBILE
  if (p.includes("android") || /\bios\b/.test(p) || p.includes("iphone os") || /\biphone\b/.test(p) || /\bipad\b/.test(p)) return { src: "../assets/platforms/mobile/mobile.svg", brand: "mobile" };

  // OTHER (STUFF WITHOUT BRANDING)
  if (p.includes("amstrad cpc") || /\bcpc\b/.test(p)) return { src: "../assets/platforms/other/cpc.svg", brand: "other", key: "cpc" };
  if (p.includes("amiga") || p.includes("commodore amiga") && !p.includes("amigaos")) return { src: "../assets/platforms/other/amiga.svg", brand: "other", key: "amiga" };

  // PC (also pc related stuff)
  if (p.includes("web browser")) return { src: "../assets/platforms/pc/webbrowser.png", brand: "pc", key: "webbrowser" };
  if (p.includes("pc") || p.includes("windows") || /\bsteam\b/.test(p)) return { src: "../assets/platforms/pc/pc.svg", brand: "pc", key: "pc" };
  if (p.includes("linux")) return { src: "../assets/platforms/pc/linux.svg", brand: "pc", key: "linux" }

  // VR
  if (p.includes("meta quest 3") || /\bquest\s*3\b/.test(p) || p.includes("meta quest 2") || /\bquest\s*2\b/.test(p)
      || p.includes("oculus quest") || /\bquest\b/.test(p)) return { src: "../assets/platforms/vr/metaquest.svg", brand: "vr", key: "quest" };
  if (p.includes("oculus go") || /\bgo\b/.test(p) || p.includes("oculus rift") || p.includes("oculus vr") || /\brift\b/.test(p)) return { src: "../assets/platforms/vr/oculus.svg", brand: "vr", key: "oculus" };
  if (p.includes("steamvr") || /steam\s*vr/.test(p)) return { src: "../assets/platforms/vr/steamvr.svg", brand: "vr", key: "steamvr" };

  return null;
}

function createGameCard(game) {
  const card = document.createElement("div");
  card.classList.add("game-card");
  card.dataset.id = game.id;

  card.addEventListener("click", () => {
    window.location.href = `../gamepage/game.html?id=${encodeURIComponent(game.id)}`;
  });

  const imageUrl = game.cover
    ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.jpg`
    : "";

  const genre =
  game.genres && game.genres.length > 0
    ? game.genres[0].name
    : "Unknown Genre";

  const studio = game.involved_companies
    ? (
        game.involved_companies.find(c => c.developer)?.company?.name ||
        game.involved_companies.find(c => c.publisher)?.company?.name ||
        "Unknown Studio"
        )
    : "Unknown Studio";

const primaryPlatform = getOriginalPlatformName(game);
const iconInfo = platformToIconInfo(primaryPlatform);

const year = game.first_release_date
  ? new Date(game.first_release_date * 1000).getUTCFullYear()
  : "—";

const rating = (typeof game.rating === "number" && isFinite(game.rating))
  ? `${Math.round(game.rating)}`
  : "—";

card.innerHTML = `
  <div class="game-cover">
    <img class="game-cover-img" src="${imageUrl}" alt="${game.name}">
    ${
      iconInfo
        ? `<div class="platform-badge platform-${iconInfo.brand} platform-${iconInfo.key || ""}" title="${primaryPlatform}">
             <img src="${iconInfo.src}" alt="${primaryPlatform}">
           </div>`
        : ``
    }
  </div>

  <div class="game-info">
    <h4>${game.name}</h4>
    <p class="game-sub">${genre} • ${studio}</p>

    <!-- Extra meta (hidden in grid, shown in table) -->
    <div class="game-meta">
      <div class="meta-item">
        ${iconInfo ? `<img class="meta-icon" src="${iconInfo.src}" alt="">` : ""}
        <span class="meta-text">${primaryPlatform || "—"}</span>
      </div>

      <div class="meta-item">
        <span class="meta-label">Year</span>
        <span class="meta-text">${year}</span>
      </div>

      <div class="meta-item">
        <span class="meta-label">Rating</span>
        <span class="meta-text">${rating}</span>
      </div>
    </div>
  </div>

  <div class="game-actions">
    <button class="btn-add">+ Add to List</button>
  </div>
`;

  return card;
}

function renderGames(games) {
  if (currentPage === 1) {
    gameGrid.innerHTML = "";
  }

  const validGames = games.filter(isRealGame);

  // no game found look

  if (validGames.length === 0 && currentPage === 1) {

  setEndUI(false);       
  setLoadingUI(false);   
  hasMore = false;
  const q = getSearchQuery() || "";
  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(q || "game")}`;

  gameGrid.innerHTML = `
    <div class="no-results" role="status" aria-live="polite">
      <div class="no-results-inner">
        <div class="no-results-icon" aria-hidden="true">
          <svg class="no-results-svg" viewBox="0 0 24 24" fill="none">
            <!-- Cloud/Controller body -->
              <path d="M7.2 9.4A4.8 4.8 0 0 1 12 5h0a4.8 4.8 0 0 1 4.8 4.4c.9-.7 2.2-.7 3.2.1 1.1.9 1.5 2.4 1.1 3.8l-.8 2.8A3.6 3.6 0 0 1 16.7 20H7.3a3.6 3.6 0 0 1-3.5-2.7l-.8-2.8c-.4-1.4 0-2.9 1.1-3.8 1-.8 2.3-.8 3.2-.1Z"
                stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>

            <!-- D-pad -->
              <path d="M7.5 12.9h2.8M8.9 11.5v2.8"
                stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>

            <!-- Buttons RIGHT  -->
              <circle cx="16.7" cy="12.4" r=".65" fill="currentColor"/>
              <circle cx="18.6" cy="13.9" r=".65" fill="currentColor"/>

            <!-- Face eyes -->
              <circle cx="10.3" cy="13.3" r=".8" fill="currentColor"/>
              <circle cx="13.7" cy="13.3" r=".8" fill="currentColor"/>

            <!-- Sad mouth -->
              <path d="M10.6 17.2Q12 16.0 13.4 17.2"
                stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
          </svg>
      </div>


        <h3>No games found</h3>
        <p>
          ${q ? `Nothing matched <span class="no-results-query">"${escapeHtml(q)}"</span>.` : `Try a different search or pick a genre.`}
        </p>

        <div class="no-results-actions">
          <button class="no-results-btn" type="button" id="clearSearchBtn">
            Clear search
          </button>

          <a class="no-results-link" href="${googleUrl}" target="_blank" rel="noopener noreferrer">
            Search on Google
          </a>
        </div>

        <div class="no-results-hint">
          Tip: check spelling, try fewer words, or remove filters.
        </div>
      </div>

      <div class="no-results-watermark" aria-hidden="true"></div>
    </div>
  `;

  // Clear button
  const clearBtn = document.getElementById("clearSearchBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      const inputEl = getSearchInput();
      if (inputEl) inputEl.value = "";
      selectedGenre = "all";
      loadGames(true);
    });
  }

  return;
}

  validGames.forEach(game => {
    gameGrid.appendChild(createGameCard(game));
  });
}

async function loadGames(reset = false) {
  if (isLoading) return;
  isLoading = true;

  if (!reset && !hasMore) {
  setLoadingUI(false);
  setEndUI(true);
  if (observer) observer.disconnect();
  if (sentinel) sentinel.hidden = true;
  return;
}

  if (reset) {
    currentPage = 1;
    gameGrid.innerHTML = "";
  }

  if (reset) {
    hasMore = true;
    setEndUI(false);
    setLoadingUI(false);
  }

  try {
    const params = new URLSearchParams({
      page: currentPage,
      sort: sortBy,
      order: sortOrder
    });

    const q = getSearchQuery();
    if (q) params.append("search", q);

    if (selectedGenre !== "all") {
      params.append("genre", selectedGenre);
    }

    if (selectedPlatform !== "all") {
      params.append("platform", selectedPlatform);
    }
    
    setLoadingUI(true);

    const res = await fetch(
      `${API_BASE_URL}/api/igdb/games?${params.toString()}`
    );

    const games = await res.json();
    hasMore = Array.isArray(games) && games.length === PAGE_SIZE;

    if (!hasMore){
      setEndUI(true);
      setLoadingUI(false); // <- loader gone and stays gone
    }

    renderGames(games);

    if (games.length > 0) {
      currentPage++;
    }

  } catch (err) {
    console.error(err);
  } finally {
    isLoading = false;
    setLoadingUI(false);
  }
}

function setupDropdown(dropdownId, onSelect) {
  const dropdown = document.getElementById(dropdownId);
  const button = dropdown.querySelector(".dropdown-btn span");
  const items = dropdown.querySelectorAll(".custom-dropdown-menu li");

  dropdown.querySelector(".dropdown-btn").addEventListener("click", () => {
    dropdown.classList.toggle("open");
  });

  items.forEach(item => {
    item.addEventListener("click", () => {
      const value = item.dataset.value;
      const label = item.dataset.label || item.textContent.trim();
      button.textContent = label;
      button.dataset.value = value;
      dropdown.classList.remove("open");
      onSelect(value);
    });
  });

  document.addEventListener("click", e => {
    if (!dropdown.contains(e.target)) {
      dropdown.classList.remove("open");
    }
  });
}

setupDropdown("genreDropdown", value => {
  selectedGenre = value;
  loadGames(true);
});

setupDropdown("platformDropdown", value => {
  selectedPlatform = value;
  setThemeWithWipe(computeTheme());
  loadGames(true);
});

setupDropdown("sortDropdown", value => {
  const [sort, order] = value.split("-");
  sortBy = sort;
  sortOrder = order;
  loadGames(true);
});

loadGames(true);

function setupInfiniteScroll(){
  if (!sentinel) return;

  if (observer) observer.disconnect();

  observer = new IntersectionObserver((entries) => {
    const entry = entries[0];
    if (!entry?.isIntersecting) return;
    if (isLoading) return;
    if (!hasMore) return;

    loadGames(false);
  }, {
    root: null,
    rootMargin: "900px 0px", // loads more right before the end
    threshold: 0
  });

  observer.observe(sentinel);
}

document.addEventListener("DOMContentLoaded", setupInfiniteScroll);

let searchTimeout;

document.addEventListener("input", (e) => {
  const t = e.target;
  if (!(t instanceof HTMLInputElement)) return;

  // react only to our search input
  if (!(t.id === "globalSearchInput" || t.classList.contains("search-input"))) return;

  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    bootSearch = "";    
    loadGames(true);
}, 300);
});