import { fetchWithAuth, clearAccessToken, getAccessToken } from "../js/global/authClient.js";
import { showToast } from "../js/global/toast.js";

const LOGIN_URL = "../LoginPageAndLogic/login.html";
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😭", "💀", "🌹"];

const state = {
  ownReview: null,
  reviews: [],
  filters: {
    recommendation: "",
    rating: ""
  },
  loadingOwn: false,
  loadingList: false
};

function redirectToLogin() {
  window.location.href = LOGIN_URL;
}

function getCurrentGameId() {
  return new URLSearchParams(window.location.search).get("id");
}

function escapeHtml(str = "") {
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[m]));
}

async function api(path, { method = "GET", body } = {}) {
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

function recommendationLabel(value) {
  return ({
    recommended: "Recommended",
    mixed: "Mixed Feelings",
    not: "Not Recommended"
  })[value] || "Unknown";
}

function formatReviewDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function profileUrl(username = "") {
  return `../profile/profile.html?username=${encodeURIComponent(username)}`;
}

function getRecommendationButtonClass(value) {
  if (value === "recommended") return "state-recommended";
  if (value === "mixed") return "state-mixed";
  if (value === "not") return "state-not";
  return "";
}

function applyDropdownButtonState(btn, type, value) {
  if (!btn) return;

  btn.classList.remove("state-recommended", "state-mixed", "state-not", "active");

  if (type === "recommendation") {
    btn.textContent = value ? recommendationLabel(value) : "Recommendation";
    if (value) {
      btn.classList.add("active");
      const cls = getRecommendationButtonClass(value);
      if (cls) btn.classList.add(cls);
    }
    return;
  }

  if (type === "rating") {
    btn.textContent = value ? String(value) : "Rating";
    if (value) btn.classList.add("active");
  }
}

function getGameTitle() {
  const el = document.getElementById("gameTitle");
  return el?.textContent?.trim() || "this game";
}

function updateReviewsHeading() {
  const heading = document.getElementById("gameReviewsHeading");
  if (!heading) return;
  heading.textContent = `Reviews for ${getGameTitle()}`;
}

function buildReactionBadges(review) {
  const reactionCounts = review?.reactionCounts || {};
  const viewerReactions = Array.isArray(review?.viewerReactions) ? review.viewerReactions : [];

  return Object.entries(reactionCounts)
    .filter(([, count]) => Number(count) > 0)
    .map(([emoji, count]) => `
      <div
        class="reaction-badge ${viewerReactions.includes(emoji) ? "active" : ""}"
        data-action="remove-reaction"
        data-emoji="${escapeHtml(emoji)}"
        title="Remove your reaction"
      >
        <span>${escapeHtml(emoji)}</span>
        <span>${escapeHtml(String(count))}</span>
      </div>
    `)
    .join("");
}

function buildReactionItems() {
  return REACTION_EMOJIS.map((emoji) => `
    <div
      class="reaction-item"
      data-action="add-reaction"
      data-emoji="${escapeHtml(emoji)}"
      title="React with ${escapeHtml(emoji)}"
    >
      ${escapeHtml(emoji)}
    </div>
  `).join("");
}

function buildReviewCard(review, { own = false } = {}) {
  const recommendation = review?.recommendation || "";
  const authorName = review?.author?.username || "Unknown User";
  const plainLength = Number(review?.plainText?.length || 0);
  const rating = review?.rating ?? "—";
  const html = review?.html || "";

  return `
    <div class="review-box ${escapeHtml(recommendation)} ${own ? "review-box--own" : ""}" data-review-id="${escapeHtml(review.id)}">
      ${own ? `<div class="review-box-own-label">Your Review</div>` : ""}

      <div class="review-hover-menu">
        <div class="reaction-items">
          ${buildReactionItems()}
        </div>
      </div>

      <div class="review-head">
        <div class="review-left">
          <div class="profile-picture">
            <img src="../assets/User/Default_User_Icon.png" alt="${escapeHtml(authorName)}">
          </div>

          <a class="review-user" href="${profileUrl(authorName)}">
            ${escapeHtml(authorName)}
          </a>
        </div>

        ${
          own
            ? `
              <div class="review-owner-actions">
                <button class="review-owner-btn" type="button" data-action="edit-own-review">Edit</button>
                <button class="review-owner-btn delete" type="button" data-action="delete-own-review">Delete</button>
              </div>
            `
            : `
              <div class="review-status ${escapeHtml(recommendation)}">
                ${escapeHtml(recommendationLabel(recommendation))}
              </div>
            `
        }
      </div>

      ${own ? `
        <div class="review-meta">
          <span>${escapeHtml(formatReviewDate(review.createdAt))}</span>
          <span>• ${escapeHtml(String(rating))}/10</span>
          <span>• ${escapeHtml(recommendationLabel(recommendation))}</span>
        </div>
      ` : `
        <div class="review-meta">
          <span>${escapeHtml(formatReviewDate(review.createdAt))}</span>
          <span>• ${escapeHtml(String(rating))}/10</span>
        </div>
      `}

      <div class="review-middle" data-plain-length="${escapeHtml(String(plainLength))}">
        ${html}
      </div>

      <div class="game-review-footer">
        <button class="review-readmore-btn" type="button">Read More</button>
        <div class="reaction-bar">
          ${buildReactionBadges(review)}
        </div>
      </div>
    </div>
  `;
}

function setupReadMore(container) {
  container.querySelectorAll(".review-box").forEach((box) => {
    const btn = box.querySelector(".review-readmore-btn");
    const content = box.querySelector(".review-middle");

    if (!btn || !content) return;

    const textLength = Number(content.dataset.plainLength || 0);

    if (textLength <= 700) {
      content.classList.add("expanded");
      btn.style.display = "none";
      return;
    }

    btn.style.display = "inline-block";
    btn.textContent = content.classList.contains("expanded") ? "Read Less" : "Read More";

    btn.addEventListener("click", () => {
      content.classList.toggle("expanded");
      btn.textContent = content.classList.contains("expanded") ? "Read Less" : "Read More";
    });
  });
}

async function handleReactionAdd(reviewId, emoji) {
  if (!getAccessToken()) {
    showToast({
      title: "Login required",
      message: "You need to be logged in to react to reviews.",
      type: "error"
    });
    redirectToLogin();
    return;
  }

  try {
    await api(`/api/reviews/${encodeURIComponent(reviewId)}/reactions`, {
      method: "POST",
      body: { emoji }
    });

    await Promise.all([loadOwnReview(), loadGameReviews()]);
  } catch (err) {
    console.error(err);

    if (err.message === "SESSION_EXPIRED") {
      redirectToLogin();
      return;
    }

    showToast({
      title: "Reaction failed",
      message: err.message || "Could not add reaction.",
      type: "error"
    });
  }
}

async function handleReactionRemove(reviewId, emoji) {
  if (!getAccessToken()) {
    showToast({
      title: "Login required",
      message: "You need to be logged in to manage reactions.",
      type: "error"
    });
    redirectToLogin();
    return;
  }

  try {
    await api(`/api/reviews/${encodeURIComponent(reviewId)}/reactions/${encodeURIComponent(emoji)}`, {
      method: "DELETE"
    });

    await Promise.all([loadOwnReview(), loadGameReviews()]);
  } catch (err) {
    console.error(err);

    if (err.message === "SESSION_EXPIRED") {
      redirectToLogin();
      return;
    }

    showToast({
      title: "Reaction update failed",
      message: err.message || "Could not update reaction.",
      type: "error"
    });
  }
}

async function deleteOwnReview() {
  const gameId = getCurrentGameId();
  if (!gameId) return;

  const ok = await window.openMglConfirm({
    title: "Delete Review",
    text: "Do you really want to delete your review for this game?",
    confirmText: "Delete",
    cancelText: "Keep"
  });

  if (!ok) return;

  try {
    await api(`/api/reviews/game/${encodeURIComponent(gameId)}`, {
      method: "DELETE"
    });

    showToast({
      title: "Review deleted",
      message: "Your review has been removed.",
      type: "success"
    });

    window.dispatchEvent(new CustomEvent("mgl:review-deleted", {
      detail: { gameId }
    }));

    await Promise.all([loadOwnReview(), loadGameReviews()]);
  } catch (err) {
    console.error(err);

    if (err.message === "SESSION_EXPIRED") {
      redirectToLogin();
      return;
    }

    showToast({
      title: "Delete failed",
      message: err.message || "Could not delete your review.",
      type: "error"
    });
  }
}

function bindReviewInteractions(container, { own = false } = {}) {
  setupReadMore(container);

  container.querySelectorAll(".review-box").forEach((box) => {
    const reviewId = box.dataset.reviewId;
    if (!reviewId) return;

    box.querySelectorAll('[data-action="add-reaction"]').forEach((item) => {
      item.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const emoji = item.dataset.emoji;
        if (!emoji) return;
        await handleReactionAdd(reviewId, emoji);
      });
    });

    box.querySelectorAll('[data-action="remove-reaction"]').forEach((item) => {
      item.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const emoji = item.dataset.emoji;
        if (!emoji) return;
        await handleReactionRemove(reviewId, emoji);
      });
    });

    if (own) {
      const editBtn = box.querySelector('[data-action="edit-own-review"]');
      const deleteBtn = box.querySelector('[data-action="delete-own-review"]');

      editBtn?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent("mgl:open-review-editor"));
      });

      deleteBtn?.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await deleteOwnReview();
      });
    }
  });
}

function renderOwnReview() {
  const container = document.getElementById("ownReviewContainer");
  if (!container) return;

  if (state.loadingOwn) {
    container.innerHTML = "";
    return;
  }

  if (!state.ownReview) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = buildReviewCard(state.ownReview, { own: true });
  bindReviewInteractions(container, { own: true });
}

function renderGameReviews() {
  const container = document.getElementById("gameReviewsContainer");
  if (!container) return;

  if (state.loadingList) {
    container.innerHTML = `<div class="game-reviews-empty">Loading reviews...</div>`;
    return;
  }

  if (!state.reviews.length) {
    container.innerHTML = `<div class="game-reviews-empty">No reviews found for the selected filters.</div>`;
    return;
  }

  container.innerHTML = state.reviews.map((review) => buildReviewCard(review)).join("");
  bindReviewInteractions(container);
}

async function loadOwnReview() {
  const gameId = getCurrentGameId();
  if (!gameId || !getAccessToken()) {
    state.ownReview = null;
    renderOwnReview();
    return;
  }

  state.loadingOwn = true;
  renderOwnReview();

  try {
    const data = await api(`/api/reviews/game/${encodeURIComponent(gameId)}/me`);
    state.ownReview = data?.review || null;
  } catch (err) {
    console.error(err);

    if (err.message === "SESSION_EXPIRED") {
      redirectToLogin();
      return;
    }

    state.ownReview = null;
  } finally {
    state.loadingOwn = false;
    renderOwnReview();
  }
}

async function loadGameReviews() {
  const gameId = getCurrentGameId();
  if (!gameId) return;

  state.loadingList = true;
  renderGameReviews();

  const params = new URLSearchParams();
  params.set("limit", "50");

  if (state.filters.recommendation) {
    params.set("recommendation", state.filters.recommendation);
  }

  if (state.filters.rating) {
    params.set("rating", state.filters.rating);
  }

  try {
    const data = await api(`/api/reviews/game/${encodeURIComponent(gameId)}?${params.toString()}`);
    state.reviews = Array.isArray(data?.reviews) ? data.reviews : [];
  } catch (err) {
    console.error(err);

    if (err.message === "SESSION_EXPIRED") {
      redirectToLogin();
      return;
    }

    state.reviews = [];
    showToast({
      title: "Reviews failed to load",
      message: err.message || "Could not load game reviews.",
      type: "error"
    });
  } finally {
    state.loadingList = false;
    renderGameReviews();
  }
}

function setupDropdown(dropdownId, type) {
  const dropdown = document.getElementById(dropdownId);
  if (!dropdown) return;

  const btn = dropdown.querySelector(".gamereview-dropdown-btn");
  const menu = dropdown.querySelector(".gamereview-dropdown-menu");
  const items = dropdown.querySelectorAll(".gamereview-dropdown-item");

  if (!btn || !menu) return;

  applyDropdownButtonState(btn, type, state.filters[type]);

  btn.addEventListener("click", (e) => {
    e.stopPropagation();

    document.querySelectorAll(".gamereview-dropdown.open").forEach((el) => {
      if (el !== dropdown) el.classList.remove("open");
    });

    dropdown.classList.toggle("open");
  });

  items.forEach((item) => {
    item.addEventListener("click", async () => {
      const value = item.dataset.value || "";
      state.filters[type] = value;

      applyDropdownButtonState(btn, type, value);
      dropdown.classList.remove("open");

      await loadGameReviews();
    });
  });
}

function closeAllReviewDropdowns() {
  document.querySelectorAll(".gamereview-dropdown.open").forEach((dropdown) => {
    dropdown.classList.remove("open");
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  updateReviewsHeading();

  setupDropdown("gamereviewDropdown", "recommendation");
  setupDropdown("ratingFilterDropdown", "rating");

  document.addEventListener("click", () => {
    closeAllReviewDropdowns();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAllReviewDropdowns();
    }
  });

  await Promise.all([loadOwnReview(), loadGameReviews()]);
});

window.addEventListener("mgl:review-saved", async () => {
  await Promise.all([loadOwnReview(), loadGameReviews()]);
});

window.addEventListener("mgl:review-deleted", async () => {
  await Promise.all([loadOwnReview(), loadGameReviews()]);
});

window.addEventListener("mgl:game-loaded", () => {
  updateReviewsHeading();
});