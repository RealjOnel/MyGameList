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
  /\bultimate\b/i,
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

  const platforms =
  game.release_dates && game.release_dates.length > 0
    ? [
        ...new Set(
          game.release_dates
            .map(r => r.platform?.name)
            .filter(Boolean)
        )
      ].join(", ")
    : "Unknown Platform";

  card.innerHTML = `
    <div class="game-cover">
      <img src="${imageUrl}" alt="${game.name}">
    </div>

    <div class="game-info">
      <h4>${game.name}</h4>
      <p>${genre} • ${studio} • ${platforms}</p>
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