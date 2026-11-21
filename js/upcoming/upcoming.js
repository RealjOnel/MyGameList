import { API_BASE_URL } from "../../backend/config.js";
import { fetchWithAuth, getAccessToken, bootstrapAuth, getAuthState } from "../global/authClient.js";
import { showToast } from "../global/toast.js";

const LOGIN_URL = "../LoginPageAndLogic/login.html";

const state = {
  items: [],
  filteredItems: [],
  selectedYear: "all",
  search: "",
  sortOrder: "asc",
  loading: false
};

function qs(id) {
  return document.getElementById(id);
}

function escapeHtml(str = "") {
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

function normalizeSearchValue(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function coverUrl(imageId) {
  return imageId
    ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`
    : "../assets/placeholder-cover.png";
}

function redirectToLogin() {
  window.location.href = LOGIN_URL;
}

function getQuarterLabel(item) {
  if (Number.isInteger(item?.releaseQuarter)) {
    return `Q${item.releaseQuarter}`;
  }

  return "TBD";
}

function getReleaseBadge(item) {
  if (item?.releaseHuman) return item.releaseHuman;
  if (Number.isInteger(item?.releaseQuarter) && item?.releaseYear) {
    return `Q${item.releaseQuarter} ${item.releaseYear}`;
  }
  if (item?.releaseYear) return String(item.releaseYear);
  return "TBD";
}

function getDaysBadge(item) {
  const days = Number(item?.daysUntil);

  if (!Number.isFinite(days)) return "TBD";
  if (days <= 0) return "Soon";
  if (days === 1) return "1 Day";
  return `${days} Days`;
}

function sortItems(items = []) {
  const sorted = [...items].sort((a, b) => {
    if (state.sortOrder === "desc") {
      return b.releaseDate - a.releaseDate;
    }
    return a.releaseDate - b.releaseDate;
  });

  return sorted;
}

function filterItems() {
  const query = normalizeSearchValue(state.search);

  let next = [...state.items];

  if (state.selectedYear !== "all") {
    next = next.filter((item) => String(item.releaseYear) === String(state.selectedYear));
  }

  if (query) {
    next = next.filter((item) => {
      const haystack = normalizeSearchValue([
        item.name,
        item.developer,
        ...(item.platforms || []),
        ...(item.genres || [])
      ].join(" "));

      return haystack.includes(query);
    });
  }

  state.filteredItems = sortItems(next);
}

function groupItems(items = []) {
  const years = new Map();

  for (const item of items) {
    const yearKey = item.releaseYear || "Unknown";

    if (!years.has(yearKey)) {
      years.set(yearKey, new Map());
    }

    const quarterMap = years.get(yearKey);
    const quarterKey = item.releaseQuarter || "TBD";

    if (!quarterMap.has(quarterKey)) {
      quarterMap.set(quarterKey, []);
    }

    quarterMap.get(quarterKey).push(item);
  }

  return years;
}

function renderYearOptions() {
  const yearFilter = qs("upcomingYearFilter");
  if (!yearFilter) return;

  const years = [...new Set(
    state.items
      .map((item) => item.releaseYear)
      .filter((year) => Number.isInteger(year))
  )].sort((a, b) => a - b);

  const currentValue = state.selectedYear;

  yearFilter.innerHTML = `
    <option value="all">All Years</option>
    ${years.map((year) => `<option value="${year}">${year}</option>`).join("")}
  `;

  yearFilter.value = years.some((year) => String(year) === String(currentValue))
    ? String(currentValue)
    : "all";
}

function renderCard(item) {
  const platforms = Array.isArray(item.platforms) ? item.platforms.slice(0, 3) : [];

  return `
    <article class="game-card" data-game-id="${escapeHtml(String(item.id))}">
      <div class="game-cover">
        <img src="${escapeHtml(coverUrl(item.coverImageId))}" alt="${escapeHtml(item.name)}">

        <div class="release-badges">
          <div class="release-badge">${escapeHtml(String(item.releaseYear || "TBD"))}</div>
          <div class="release-badge">${escapeHtml(getDaysBadge(item))}</div>
        </div>
      </div>

      <div class="game-info">
        <h3>${escapeHtml(item.name)}</h3>
        <p class="game-dev">${escapeHtml(item.developer || "Unknown Studio")}</p>

        <div class="platforms-upcoming">
          ${platforms.length
            ? platforms.map((platform) => `<span>${escapeHtml(platform)}</span>`).join("")
            : `<span>TBD</span>`
          }
        </div>

        <div class="countdown">${escapeHtml(getReleaseBadge(item))}</div>

        <button class="wishlist-btn" type="button" data-add-upcoming="${escapeHtml(String(item.id))}">
          Add to Wishlist
        </button>
      </div>
    </article>
  `;
}

function bindCardActions() {
  const content = qs("upcomingContent");
  if (!content) return;

  content.querySelectorAll(".game-card[data-game-id]").forEach((card) => {
    if (card.dataset.bound === "true") return;
    card.dataset.bound = "true";

    card.addEventListener("click", (e) => {
      const target = e.target;
      if (target instanceof HTMLElement && target.closest("[data-add-upcoming]")) {
        return;
      }

      const gameId = card.dataset.gameId;
      if (!gameId) return;

      window.location.href = `../gamepage/game.html?id=${encodeURIComponent(gameId)}`;
    });
  });

  content.querySelectorAll("[data-add-upcoming]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";

    button.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const gameId = button.getAttribute("data-add-upcoming");
      if (!gameId) return;

      if (getAuthState() === "loading") {
        await bootstrapAuth();
      }

      if (!getAccessToken()) {
        redirectToLogin();
        return;
      }

      button.disabled = true;
      const previousText = button.textContent;
      button.textContent = "Adding...";

      try {
        const res = await fetchWithAuth("/api/library/add", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            igdbId: Number(gameId),
            status: "planned"
          })
        });

        const text = await res.text();
        const data = text ? JSON.parse(text) : {};

        if (res.status === 401) {
          redirectToLogin();
          return;
        }

        if (!res.ok) {
          throw new Error(data?.message || `Request failed (${res.status})`);
        }

        button.textContent = "In Wishlist";
        button.disabled = true;

        showToast({
          title: "Added to wishlist",
          message: "The game was added to your planned list.",
          type: "success"
        });
      } catch (err) {
        console.error(err);

        button.textContent = previousText;
        button.disabled = false;

        showToast({
          title: "Wishlist failed",
          message: err.message || "Could not add the game to your wishlist.",
          type: "error"
        });
      }
    });
  });
}

function renderUpcoming() {
  const content = qs("upcomingContent");
  if (!content) return;

  if (state.loading) {
    content.innerHTML = `<div class="upcoming-loading">Loading upcoming games...</div>`;
    return;
  }

  if (!state.filteredItems.length) {
    content.innerHTML = `
      <div class="upcoming-empty">
        <h3>No upcoming games found</h3>
        <p>Try a different search or reset the year filter.</p>
      </div>
    `;
    return;
  }

  const grouped = groupItems(state.filteredItems);

  const yearEntries = [...grouped.entries()].sort((a, b) => {
    const aYear = Number(a[0]);
    const bYear = Number(b[0]);

    if (state.sortOrder === "desc") {
      return bYear - aYear;
    }
    return aYear - bYear;
  });

  content.innerHTML = yearEntries.map(([year, quarterMap]) => {
    const quarterEntries = [...quarterMap.entries()].sort((a, b) => {
      const aQuarter = a[0] === "TBD" ? 99 : Number(a[0]);
      const bQuarter = b[0] === "TBD" ? 99 : Number(b[0]);

      if (state.sortOrder === "desc") {
        return bQuarter - aQuarter;
      }
      return aQuarter - bQuarter;
    });

    const yearCount = [...quarterMap.values()].reduce((sum, items) => sum + items.length, 0);

    return `
      <section class="upcoming-year-block">
        <div class="upcoming-year-head">
          <h2>${escapeHtml(String(year))}</h2>
          <span>${escapeHtml(String(yearCount))} game(s)</span>
        </div>

        ${quarterEntries.map(([quarter, items]) => `
          <div class="upcoming-quarter-block">
            <div class="upcoming-quarter-head">
              <h3>${quarter === "TBD" ? "TBD" : `Q${escapeHtml(String(quarter))}`}</h3>
              <span>${escapeHtml(String(items.length))} release(s)</span>
            </div>

            <div class="upcoming-grid">
              ${items.map(renderCard).join("")}
            </div>
          </div>
        `).join("")}
      </section>
    `;
  }).join("");

  bindCardActions();
}

async function loadUpcoming() {
  state.loading = true;
  renderUpcoming();

  try {
    const res = await fetch(`${API_BASE_URL}/api/igdb/upcoming?limit=240`, {
      cache: "no-store"
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "Failed to load upcoming games");
    }

    state.items = Array.isArray(data) ? data : [];
    renderYearOptions();
    filterItems();
    renderUpcoming();
  } catch (err) {
    console.error(err);

    const content = qs("upcomingContent");
    if (content) {
      content.innerHTML = `
        <div class="upcoming-empty">
          <h3>Upcoming games failed to load</h3>
          <p>${escapeHtml(err.message || "Something went wrong.")}</p>
        </div>
      `;
    }
  } finally {
    state.loading = false;
    renderUpcoming();
  }
}

function bindControls() {
  const searchInput = qs("upcomingSearchInput");
  const yearFilter = qs("upcomingYearFilter");
  const orderToggle = qs("upcomingOrderToggle");
  const resetBtn = qs("upcomingResetBtn");

  let searchTimer = null;

  searchInput?.addEventListener("input", () => {
    clearTimeout(searchTimer);

    searchTimer = setTimeout(() => {
      state.search = searchInput.value.trim();
      filterItems();
      renderUpcoming();
    }, 180);
  });

  yearFilter?.addEventListener("change", () => {
    state.selectedYear = yearFilter.value;
    filterItems();
    renderUpcoming();
  });

  orderToggle?.addEventListener("click", () => {
    state.sortOrder = state.sortOrder === "asc" ? "desc" : "asc";
    orderToggle.textContent = state.sortOrder === "asc" ? "↑" : "↓";
    filterItems();
    renderUpcoming();
  });

  resetBtn?.addEventListener("click", () => {
    state.search = "";
    state.selectedYear = "all";
    state.sortOrder = "asc";

    if (searchInput) searchInput.value = "";
    if (yearFilter) yearFilter.value = "all";
    if (orderToggle) orderToggle.textContent = "↑";

    filterItems();
    renderUpcoming();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindControls();
  loadUpcoming().catch(console.error);
});