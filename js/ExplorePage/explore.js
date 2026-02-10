const gameGrid = document.getElementById("gameGrid");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const sortSelect = document.getElementById("sortSelect");

let currentPage = 1;
let isLoading = false;
// Default sort: highest rated games first (as a popularity proxy)
let sortBy = "rating";
let sortOrder = "desc";

const searchInput = document.querySelector(".search-input");
const genreSelect = document.querySelector(".filter-select");

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
  const selectedGenre = genreSelect.value.toLowerCase();

  allLoadedGames
    .filter(isRealGame)

    .filter(game => {
      const nameMatch = game.name
        .toLowerCase()
        .includes(searchValue);

      const genreMatch =
        selectedGenre === "all" ||
        (game.genres &&
          game.genres.some(g =>
            g.name.toLowerCase().includes(selectedGenre)
          ));

      return nameMatch && genreMatch;
    })

    .forEach(game => {
      gameGrid.appendChild(createGameCard(game));
    });
}

async function loadGames() {
  if (isLoading) return;
  isLoading = true;

  try {
    const res = await fetch(
      `${API_BASE_URL}/api/igdb/games?page=${currentPage}&sort=${sortBy}&order=${sortOrder}`
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

sortSelect.addEventListener("change", e => {
  const [sort, order] = e.target.value.split("-");

  sortBy = sort;
  sortOrder = order;

  currentPage = 1;
  allLoadedGames = [];
  gameGrid.innerHTML = "";
  loadGames();
});

loadGames();

loadMoreBtn.addEventListener("click", loadGames);
searchInput.addEventListener("input", renderGames);
genreSelect.addEventListener("change", renderGames);