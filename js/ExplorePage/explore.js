const gameGrid = document.getElementById("gameGrid");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const sortSelect = document.getElementById("sortSelect");

let currentPage = 1;
let isLoading = false;
let sortBy = "name";
let sortOrder = "asc";

const searchInput = document.querySelector(".search-input");
const genreSelect = document.querySelector(".filter-select");

let allLoadedGames = [];

const bannedWords = [
  "pack",
  "dlc",
  "costume",
  "skin",
  "character",
  "expansion",
  "season pass",
  "bundle",
  "collector",
  "collector's",
];

function isRealGame(game) {
  if (!game || !game.name) return false;

  const name = game.name.toLowerCase();

  if (bannedWords.some(word => name.includes(word))) {
    return false;
  }

  if (!game.cover) {
    return false;
  }

  return true;
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

  const res = await fetch(
  `http://localhost:4000/api/igdb/games?page=${currentPage}&sort=${sortBy}&order=${sortOrder}`
);

  const games = await res.json(); 

  allLoadedGames.push(...games);
  renderGames();

  currentPage++;
  isLoading = false;
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