const gameGrid = document.getElementById("gameGrid");
const loadMoreBtn = document.getElementById("loadMoreBtn");

let currentPage = 1;
let isLoading = false;
// Default sort: highest rated games first (as a popularity proxy)
let sortBy = "rating";
let sortOrder = "desc";
let selectedGenre = "all";
let searchQuery = "";

const searchInput = document.querySelector(".search-input");

let allLoadedGames = [];

const API_BASE_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:4000"
    : "https://mygamelist-omhm.onrender.com";

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
    ? game.genres.map(g => g.name).join(", ")
    : "Unknown Genre";

  const studio = game.involved_companies
    ? (
        game.involved_companies.find(c => c.developer)?.company?.name ||
        game.involved_companies.find(c => c.publisher)?.company?.name ||
        "Unknown Studio"
        )
    : "Unknown Studio";

  card.innerHTML = `
    <div class="game-cover">
      <img src="${imageUrl}" alt="${game.name}">
    </div>

    <div class="game-info">
      <h4>${game.name}</h4>
      <p>${genre} • ${studio}</p>
      <button class="btn-add">+ Add to List</button>
    </div>
  `;

  return card;
}

function renderGames() {
  gameGrid.innerHTML = "";

  const searchValue = searchInput.value.toLowerCase();
  const genreValue = selectedGenre;

  allLoadedGames
    .filter(isRealGame)

    .filter(game => {
      const nameMatch = game.name
        .toLowerCase()
        .includes(searchValue);

      const genreMatch =
        genreValue === "all" ||
          (game.genres &&
          game.genres.some(g =>
          g.name.toLowerCase().includes(genreValue)
      ));

      return nameMatch && genreMatch;
    })

    .forEach(game => {
      gameGrid.appendChild(createGameCard(game));
    });
    
    if (gameGrid.children.length === 0) {
        gameGrid.innerHTML = `<p class="no-results">No games found</p>`;
      }
}

async function loadGames() {
  if (isLoading) return;
  isLoading = true;

  try {
    const params = new URLSearchParams({
      page: currentPage,
      sort: sortBy,
      order: sortOrder
    });

    if (searchQuery.trim() !== "") {
      params.append("search", searchQuery.trim());
    }

    const res = await fetch(
      `${API_BASE_URL}/api/igdb/games?${params.toString()}`
    );

    if (!res.ok) {
      throw new Error(`Explore request failed (${res.status})`);
    }

    const games = await res.json();
    if (!Array.isArray(games)) {
      throw new Error("Explore response was not an array");
    }

    allLoadedGames.push(...games);
    renderGames();

    // Only advance page if we actually got results.
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
  renderGames();
});

setupDropdown("sortDropdown", value => {
  const [sort, order] = value.split("-");
  sortBy = sort;
  sortOrder = order;
  currentPage = 1;
  allLoadedGames = [];
  gameGrid.innerHTML = "";
  loadGames();
});

loadGames();

loadMoreBtn.addEventListener("click", loadGames);

let searchTimeout;

searchInput.addEventListener("input", () => {
  clearTimeout(searchTimeout);

  searchTimeout = setTimeout(() => {
    searchQuery = searchInput.value;
    currentPage = 1;
    allLoadedGames = [];
    gameGrid.innerHTML = "";
    loadGames();
  }, 300); // Debounce
});