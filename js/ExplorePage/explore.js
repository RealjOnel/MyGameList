import { API_BASE_URL } from "../../backend/config.js";
const gameGrid = document.getElementById("gameGrid");
const loadMoreBtn = document.getElementById("loadMoreBtn");

let currentPage = 1;
let isLoading = false;
// Default sort: highest rated games first (as a popularity proxy)
let sortBy = "rating";
let sortOrder = "desc";
let selectedGenre = "all";

const searchInput = document.querySelector(".search-input");

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

  // nur Einträge mit Plattform
  const usable = rds
    .filter(r => r?.platform?.name)
    .map(r => ({
      name: r.platform.name,
      date: typeof r.date === "number" ? r.date : Infinity
    }));

  if (usable.length === 0) return null;

  // wenn wir Datumswerte haben: frühestes Datum gewinnt
  const withDates = usable.filter(x => x.date !== Infinity);
  if (withDates.length > 0) {
    withDates.sort((a, b) => a.date - b.date);
    return withDates[0].name;
  }

  // fallback: wenn IGDB keine dates liefert
  return usable[0].name;
}

function platformToIconInfo(platformName) {
  if (!platformName) return null;
  const p = platformName.toLowerCase();

  // SONY
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

  // NINTENDO
  if (p.includes("nintendo switch 2") || /\bswitch\s*2\b/.test(p) || p.includes("switch2")) return { src: "../assets/platforms/nintendo/switch2.svg", brand: "nintendo", key: "switch2" };
  if (p.includes("switch" || /\bswitch\s*1\b/.test(p) )) return { src: "../assets/platforms/nintendo/switch1.svg", brand: "nintendo" };
  if (p.includes("wii u")) return { src: "../assets/platforms/nintendo/wiiu.svg", brand: "nintendo" };
  if (p.includes("wii")) return { src: "../assets/platforms/nintendo/wii.svg", brand: "nintendo" };
  if (p.includes("virtual boy")) return { src: "../assets/platforms/nintendo/virtualboy.svg", brand: "nintendo" };
  if (p.includes("nintendo 64") || p.includes("n64")) return { src: "../assets/platforms/nintendo/n64.svg", brand: "nintendo" };
  if (p.includes("gamecube")) return { src: "../assets/platforms/nintendo/gcn.svg", brand: "nintendo" };
  if (p.includes("super nintendo") || p.includes("snes") || p.includes("super famicom")) return { src: "../assets/platforms/nintendo/snes.svg", brand: "nintendo", key: "snes" };
  if (p.includes("nintendo entertainment system") || /\bnes\b/.test(p) || p.includes("famicom") || p.includes("family computer")) {return { src: "../assets/platforms/nintendo/nes.svg", brand: "nintendo", key: "nes" };}
  if (p.includes("game boy advance") || p.includes("gba")) return { src: "../assets/platforms/nintendo/gba.svg", brand: "nintendo" };
  if (p.includes("game boy color") || p.includes("gbc")) return { src: "../assets/platforms/nintendo/gbcolor.svg", brand: "nintendo" };
  if (p.includes("game boy")) return { src: "../assets/platforms/nintendo/gameboy.svg", brand: "nintendo" };
  if (p.includes("nintendo ds") || p.includes("nds") || p === "ds") return { src: "../assets/platforms/nintendo/ds.svg", brand: "nintendo" };
  if (p.includes("nintendo 3ds") || p.includes("3ds")) return { src: "../assets/platforms/nintendo/3ds.svg", brand: "nintendo" };

   // MOBILE (BRAUCHT NOCH EIGENE BRAND FÜR CSS)
  if (p.includes("android")) return { src: "../assets/platforms/mobile/android.svg", brand: "mobile", key: "android" };
  if (/\bios\b/.test(p) || p.includes("iphone os") || /\biphone\b/.test(p) || /\bipad\b/.test(p)) return { src: "../assets/platforms/mobile/ios.svg", brand: "mobile", key: "ios" };

  // PC (also pc related stuff)
  if (p.includes("pc") || p.includes("windows") || /\bsteam\b/.test(p)) return { src: "../assets/platforms/pc/pc.svg", brand: "pc", key: "pc" };
  if (p.includes("linux")) return { src: "../assets/platforms/pc/linux.svg", brand: "pc", key: "linux" }

  // VR [BRAUCHT NOCH EIGENE BRAND FÜR CSS])
  if (p.includes("meta quest 3") || /\bquest\s*3\b/.test(p) || p.includes("meta quest 2") || /\bquest\s*2\b/.test(p)
      || p.includes("oculus quest") || /\bquest\b/.test(p)) return { src: "../assets/platforms/vr/metaquest.svg", brand: "vr", key: "quest" };
  if (p.includes("oculus go") || /\bgo\b/.test(p) || p.includes("oculus rift") || p.includes("oculus vr") || /\brift\b/.test(p)) return { src: "../assets/platforms/vr/oculus.svg", brand: "vr", key: "oculus" };
  if (p.includes("steamvr") || /steam\s*vr/.test(p)) return { src: "../assets/platforms/vr/steamvr.svg", brand: "vr", key: "steamvr" };

  // OTHER (STUFF WITHOUT BRANDING [STILL NEEDS CSS])

  return null;
}

function createGameCard(game) {
  const card = document.createElement("div");
  card.classList.add("game-card");

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
const iconInfo = platformToIconInfo(primaryPlatform); // { src, brand } or null

card.innerHTML = `
  <div class="game-cover">
    <img class="game-cover-img" src="${imageUrl}" alt="${game.name}">
    ${
      iconInfo
        ? `<div class="platform-badge platform-${iconInfo.brand} platform-${iconInfo.key}" title="${primaryPlatform}">
             <img src="${iconInfo.src}" alt="${primaryPlatform}">
           </div>`
        : ``
    }
  </div>

  <div class="game-info">
    <h4>${game.name}</h4>
    <p>${genre} • ${studio}</p>
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

  if (validGames.length === 0 && currentPage === 1) {
    gameGrid.innerHTML = `<p class="no-results">No games found</p>`;
    return;
  }

  validGames.forEach(game => {
    gameGrid.appendChild(createGameCard(game));
  });
}

async function loadGames(reset = false) {
  if (isLoading) return;
  isLoading = true;

  if (reset) {
    currentPage = 1;
    gameGrid.innerHTML = "";
  }

  try {
    const params = new URLSearchParams({
      page: currentPage,
      sort: sortBy,
      order: sortOrder
    });

    if (searchInput.value.trim()) {
      params.append("search", searchInput.value.trim());
    }

    if (selectedGenre !== "all") {
      params.append("genre", selectedGenre);
    }

    const res = await fetch(
      `${API_BASE_URL}/api/igdb/games?${params.toString()}`
    );

    const games = await res.json();

    renderGames(games);

    if (games.length > 0) {
      currentPage++;
    }

  } catch (err) {
    console.error(err);
  } finally {
    isLoading = false;
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
      button.textContent = item.textContent;
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

setupDropdown("sortDropdown", value => {
  const [sort, order] = value.split("-");
  sortBy = sort;
  sortOrder = order;
  loadGames(true);
});

loadGames(true);

loadMoreBtn.addEventListener("click", () => {
  loadGames();
});

let searchTimeout;

searchInput.addEventListener("input", () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    loadGames(true);
  }, 300);
});