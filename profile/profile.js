import { API_BASE_URL } from "../backend/config.js";
import { fetchWithAuth, getAccessToken, clearAccessToken } from "../js/global/authClient.js";
import { showToast } from "../js/global/toast.js";

function qs(sel) { return document.querySelector(sel); }

const LOGIN_URL = "../LoginPageAndLogic/login.html";

const DEFAULT_SETTINGS = Object.freeze({
  profile: {
    bio: "",
    links: {
      discord: "",
      youtube: "",
      twitch: "",
      steam: "",
      website: ""
    },
    optionalFields: {
      location: "",
      favoriteGenre: "",
      favoritePlatform: ""
    }
  },
  social: {
    showFriendsList: true,
    showReviews: true,
    showForumActivity: true,
    showFavoriteGames: true,
    showActivityHistory: true,
    allowProfileComments: true,
    showProfileComments: true
  },
  privacy: {
    publicProfile: true,
    showProfileInSearch: true,
    allowDirectFriendRequests: true,
    cookies: {
      preferences: true,
      analytics: false
    }
  },
  customization: {
    defaultExploreView: "grid",
    compactInterface: false,
    reducedMotion: false,
    liveSearchSuggestions: true
  }
});

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function deepMerge(target, source) {
  const out = { ...target };

  for (const [key, value] of Object.entries(source || {})) {
    if (isPlainObject(value) && isPlainObject(out[key])) {
      out[key] = deepMerge(out[key], value);
    } else {
      out[key] = value;
    }
  }

  return out;
}

function normalizeSettings(raw) {
  return deepMerge(cloneDefaults(), raw || {});
}

function redirectToLogin() {
  window.location.href = LOGIN_URL;
}

function showLoginRequiredToast(message = "Please log in to use this feature.") {
  showToast({
    title: "Login required",
    message,
    type: "info"
  });
}

function buildApiUrl(path) {
  return /^https?:\/\//i.test(path) ? path : `${API_BASE_URL}${path}`;
}

function buildFinalPath(path, method) {
  if (method !== "GET") return path;
  return `${path}${path.includes("?") ? "&" : "?"}_=${Date.now()}`;
}

async function readJsonResponse(res) {
  const text = await res.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

/*
  Public/optional-auth API:
  - uses token if available, but falls back to cookie-based session for unauthenticated users
*/
async function api(path, { method = "GET", body } = {}) {
  const finalPath = buildFinalPath(path, method);

  const headers = {};
  if (body) {
    headers["Content-Type"] = "application/json";
  }

  let res;

  if (getAccessToken()) {
    res = await fetchWithAuth(finalPath, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    if (res.status === 401) {
      clearAccessToken();

      res = await fetch(buildApiUrl(finalPath), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        credentials: "include",
        cache: "no-store"
      });
    }
  } else {
    res = await fetch(buildApiUrl(finalPath), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "include",
      cache: "no-store"
    });
  }

  const data = await readJsonResponse(res);

  if (!res.ok) {
    throw new Error(data?.message || `Request failed (${res.status})`);
  }

  return data;
}

/*
  Strict auth API:
  - only for logged-in users, will throw if no valid token is present
*/
async function authApi(path, { method = "GET", body } = {}) {
  if (!getAccessToken()) {
    throw new Error("AUTH_REQUIRED");
  }

  const finalPath = buildFinalPath(path, method);

  const headers = {};
  if (body) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetchWithAuth(finalPath, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await readJsonResponse(res);

  if (res.status === 401) {
    clearAccessToken();
    throw new Error("SESSION_EXPIRED");
  }

  if (!res.ok) {
    throw new Error(data?.message || `Request failed (${res.status})`);
  }

  return data;
}

async function loadCurrentUserOptional() {
  if (!getAccessToken()) {
    return null;
  }

  try {
    return await authApi("/api/users/me");
  } catch (err) {
    if (err.message === "SESSION_EXPIRED" || err.message === "AUTH_REQUIRED") {
      clearAccessToken();
      return null;
    }

    console.error("Could not load current user:", err);
    return null;
  }
}

function coverUrl(coverImageId) {
  return coverImageId
    ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${coverImageId}.jpg`
    : "../../assets/placeholder-cover.png";
}

function avatarUrl(avatar) {
  return avatar || "../assets/User/Default_User_Icon.png";
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB");
}

function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function statusLabel(status) {
  return ({
    playing: "Currently Playing",
    planned: "Planned",
    completed: "Completed",
    on_hold: "On Hold",
    dropped: "Dropped"
  })[status] || "Unknown";
}

function statusClass(status) {
  return ({
    playing: "pg_state_playing",
    planned: "pg_state_planed",
    completed: "pg_state_completed",
    on_hold: "pg_state_onhold",
    dropped: "pg_state_dropped"
  })[status] || "pg_state";
}

function normalizeExternalUrl(raw) {
  if (!raw) return null;
  const value = String(raw).trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function renderProfileSocialLinks(settings) {
  const wrap = document.getElementById("profileSocialLinks");
  if (!wrap) return;

  const links = settings?.profile?.links || {};
  const items = [
    { key: "discord", icon: "fa-brands fa-discord", label: "Discord" },
    { key: "youtube", icon: "fa-brands fa-youtube", label: "YouTube" },
    { key: "twitch", icon: "fa-brands fa-twitch", label: "Twitch" },
    { key: "steam", icon: "fa-brands fa-steam", label: "Steam" },
    { key: "website", icon: "fa-solid fa-globe", label: "Website" }
  ]
    .map((item) => ({
      ...item,
      href: normalizeExternalUrl(links[item.key])
    }))
    .filter((item) => item.href);

  wrap.innerHTML = "";

  if (!items.length) {
    wrap.innerHTML = `<div class="muted">No social links added.</div>`;
    return;
  }

  for (const item of items) {
    const a = document.createElement("a");
    a.href = item.href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.className = "profile_social_link";
    a.setAttribute("aria-label", item.label);
    a.title = item.label;
    a.innerHTML = `<i class="${item.icon}"></i>`;
    wrap.appendChild(a);
  }
}

function renderProfileBio(settings) {
  const wrap = document.getElementById("profileBioContent");
  if (!wrap) return;

  const profile = settings?.profile || {};
  const optional = profile.optionalFields || {};
  const rows = [];

  if (profile.bio) rows.push({ label: "Bio", value: profile.bio });
  if (optional.location) rows.push({ label: "Location", value: optional.location });
  if (optional.favoriteGenre) rows.push({ label: "Favorite Genre", value: optional.favoriteGenre });
  if (optional.favoritePlatform) rows.push({ label: "Favorite Platform", value: optional.favoritePlatform });

  wrap.innerHTML = "";

  if (!rows.length) {
    wrap.innerHTML = `<div class="muted">No profile details yet.</div>`;
    return;
  }

  for (const row of rows) {
    const line = document.createElement("div");
    line.className = "bio_line";
    line.textContent = `${row.label}: ${row.value}`;
    wrap.appendChild(line);
  }
}

function applyProfileVisibility(settings, visibility = {}) {
  const social = settings?.social || {};
  const isOwner = visibility?.isOwner === true;

  const friendsSection = document.getElementById("profileFriendsSection");
  const favoritesSection = document.getElementById("profileFavoritesSection");
  const recentActivitySection = document.getElementById("profileRecentActivitySection");
  const commentsSection = document.getElementById("profileCommentsSection");
  const reviewsSection = document.getElementById("profileReviewsSection");

  if (isOwner) {
    if (friendsSection) friendsSection.hidden = false;
    if (favoritesSection) favoritesSection.hidden = false;
    if (recentActivitySection) recentActivitySection.hidden = false;
    if (commentsSection) commentsSection.hidden = false;
    if (reviewsSection) reviewsSection.hidden = false;
    return;
  }

  if (friendsSection) friendsSection.hidden = !social.showFriendsList;
  if (favoritesSection) favoritesSection.hidden = !social.showFavoriteGames;
  if (recentActivitySection) recentActivitySection.hidden = !social.showActivityHistory;
  if (commentsSection) commentsSection.hidden = social.showProfileComments === false;
  if (reviewsSection) reviewsSection.hidden = !social.showReviews;
}

function applyCommentComposerVisibility(settings, isOwner) {
  const social = settings?.social || {};

  const commentHeading = document.querySelector(".profile_comments h3");
  const commentWrapper = document.querySelector(".profile_comments .comment_wrapper");
  const commentMeta = document.querySelector(".profile_comments .comment_meta");

  const commentsAllowed = social.allowProfileComments !== false;

  if (commentWrapper) {
    commentWrapper.hidden = !commentsAllowed || isOwner;
  }

  if (commentMeta) {
    commentMeta.hidden = !commentsAllowed || isOwner;
  }

  if (commentHeading) {
    if (!commentsAllowed || isOwner) {
      commentHeading.textContent = "Profile Comments";
    } else {
      commentHeading.textContent = `Leave a Comment`;
    }
  }
}

function renderRecentActivity(items) {
  const wrap = document.getElementById("recentActivityWrap");
  if (!wrap) return;

  wrap.innerHTML = "";

  const recent = [...items]
    .filter(e => e?.game)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 4);

  if (!recent.length) {
    wrap.innerHTML = `<div class="muted">No recent activity yet.</div>`;
    return;
  }

  for (const e of recent) {
    const btn = document.createElement("button");
    btn.className = "pg_item";
    btn.type = "button";

    btn.innerHTML = `
      <div class="pg_card">
        <div class="pg_iconclass">
          <img src="${coverUrl(e.game.coverImageId)}" class="pg_icon" alt="${e.game.name || "Game cover"}">
        </div>
        <div class="pg_stateclass">
          <div class="pg_top">
            <span class="pg_name">${e.game.name || "Unknown Game"}</span>
            <span class="${statusClass(e.status)}">${statusLabel(e.status)}</span>
          </div>

          <div class="pg_bottom">
            <span class="pg_state">Rating: ${e.rating ?? "—"}</span>
            <span class="pg_state last_edit">Last Edit: ${formatDateTime(e.updatedAt)}</span>
          </div>
        </div>
      </div>
    `;

    btn.addEventListener("click", () => {
      window.location.href = `../gamepage/game.html?id=${encodeURIComponent(e.game.igdbId)}`;
    });

    wrap.appendChild(btn);
  }
}

function renderFriendsList(friends = []) {
  const wrap = document.getElementById("profileFriendsList");
  if (!wrap) return;

  wrap.innerHTML = "";

  if (!friends.length) {
    wrap.innerHTML = `<div class="muted">No friends yet.</div>`;
    return;
  }

  for (const friend of friends) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "friend_item";

    btn.innerHTML = `
      <img src="${avatarUrl(friend.avatarUrl)}" alt="${friend.username || "Friend"}" class="friend_icon">
      <span class="friend_name">${friend.username || "Unknown User"}</span>
    `;

    btn.addEventListener("click", () => {
      window.location.href = `./profile.html?username=${encodeURIComponent(friend.username)}`;
    });

    wrap.appendChild(btn);
  }
}

function recommendationLabel(value) {
  return ({
    recommended: "Recommended",
    mixed: "Mixed Feelings",
    not: "Not Recommended"
  })[value] || "Unknown";
}

function recommendationClass(value) {
  return ({
    recommended: "recommended",
    mixed: "mixed",
    not: "not"
  })[value] || "";
}

function truncateText(value = "", max = 220) {
  const text = String(value || "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}...`;
}

function renderProfileReviewsCard(review) {
  const game = review?.game || {};
  const rating = review?.rating ?? "—";
  const date = formatDate(review?.createdAt);
  const preview = truncateText(review?.plainText || "", 220);

  return `
    <button class="review_item" type="button" data-review-id="${review.id}">
      <div class="review_card">
        <div class="review_iconclass">
          <img
            src="${coverUrl(game.coverImageId)}"
            class="review_icon"
            alt="${game.name || "Game cover"}"
          >
        </div>

        <div class="review_contentclass">
          <div class="review_top">
            <h3>${game.name || "Unknown Game"}</h3>
            <p>${preview || "No preview available."}</p>
          </div>

          <div class="review_bottom">
            <div class="review_text">
              <p class="review_rating">${recommendationLabel(review.recommendation)} • ${rating}/10</p>
              <p>${date}</p>
            </div>
          </div>
        </div>
      </div>
    </button>
  `;
}

function getProfileReviewModalEls() {
  return {
    modal: document.getElementById("profileReviewModal"),
    closeBtn: document.getElementById("profileReviewModalClose"),
    openGameBtn: document.getElementById("profileReviewModalOpenGame"),
    title: document.getElementById("profileReviewModalTitle"),
    cover: document.getElementById("profileReviewModalCover"),
    game: document.getElementById("profileReviewModalGame"),
    author: document.getElementById("profileReviewModalAuthor"),
    info: document.getElementById("profileReviewModalInfo"),
    recommendation: document.getElementById("profileReviewModalRecommendation"),
    content: document.getElementById("profileReviewModalContent")
  };
}

function openProfileReviewModal() {
  const { modal } = getProfileReviewModalEls();
  if (!modal) return;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeProfileReviewModal() {
  const { modal } = getProfileReviewModalEls();
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = "";
}

function fillProfileReviewModal(review) {
  const els = getProfileReviewModalEls();
  if (!els.modal) return;

  const game = review?.game || {};
  const authorName = review?.author?.username || "Unknown User";
  const rating = review?.rating ?? "—";
  const date = formatDate(review?.createdAt);

  els.title.textContent = "Review";
  els.cover.src = coverUrl(game.coverImageId);
  els.cover.alt = game.name || "Game cover";
  els.game.textContent = game.name || "Unknown Game";
  els.author.textContent = `By ${authorName}`;
  els.info.textContent = `${date} • ${rating}/10`;
  els.recommendation.textContent = recommendationLabel(review?.recommendation);
  els.recommendation.className = `profile-review-modal-recommendation ${recommendationClass(review?.recommendation)}`;
  els.content.innerHTML = review?.html || "<p>No review content available.</p>";

  els.openGameBtn.onclick = () => {
    if (!game.igdbId) return;
    window.location.href = `../gamepage/game.html?id=${encodeURIComponent(game.igdbId)}`;
  };
}

function bindProfileReviewModal() {
  const { modal, closeBtn } = getProfileReviewModalEls();
  if (!modal || modal.dataset.bound === "true") return;

  modal.dataset.bound = "true";

  closeBtn?.addEventListener("click", closeProfileReviewModal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeProfileReviewModal();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) {
      closeProfileReviewModal();
    }
  });
}

async function openReviewDetails(reviewId) {
  if (!reviewId) return;

  try {
    const data = await api(`/api/reviews/${encodeURIComponent(reviewId)}`);
    fillProfileReviewModal(data?.review);
    openProfileReviewModal();
  } catch (err) {
    console.error(err);

    showToast({
      title: "Review failed to load",
      message: err.message || "Could not load the full review.",
      type: "error"
    });
  }
}

async function loadProfileReviews(username) {
  const list = document.getElementById("profileReviewsList");
  const showMoreBtn = document.getElementById("profileReviewsShowMore");
  if (!list || !showMoreBtn || !username) return;

  bindProfileReviewModal();

  let page = 1;
  const limit = 2;
  let loading = false;
  let hasMore = false;

  async function loadPage({ append = false } = {}) {
    if (loading) return;
    loading = true;

    if (!append) {
      list.innerHTML = `<div class="profile_review_empty">Loading reviews...</div>`;
    }

    try {
      const data = await api(`/api/reviews/profile/${encodeURIComponent(username)}?page=${page}&limit=${limit}`);
      const reviews = Array.isArray(data?.reviews) ? data.reviews : [];
      hasMore = Boolean(data?.pagination?.hasMore);

      if (!append) {
        if (!reviews.length) {
          list.innerHTML = `<div class="profile_review_empty">No reviews yet.</div>`;
        } else {
          list.innerHTML = reviews.map(renderProfileReviewsCard).join("");
        }
      } else {
        list.insertAdjacentHTML("beforeend", reviews.map(renderProfileReviewsCard).join(""));
      }

      list.querySelectorAll(".review_item[data-review-id]").forEach((btn) => {
        if (btn.dataset.bound === "true") return;
        btn.dataset.bound = "true";

        btn.addEventListener("click", () => {
          openReviewDetails(btn.dataset.reviewId).catch(console.error);
        });
      });

      showMoreBtn.hidden = !hasMore;
    } catch (err) {
      console.error(err);

      if (!append) {
        list.innerHTML = `<div class="profile_review_empty">Failed to load reviews.</div>`;
      }

      showToast({
        title: "Reviews failed to load",
        message: err.message || "Could not load profile reviews.",
        type: "error"
      });

      showMoreBtn.hidden = true;
    } finally {
      loading = false;
    }
  }

  showMoreBtn.onclick = async () => {
    if (!hasMore || loading) return;
    page += 1;
    await loadPage({ append: true });
  };

  await loadPage();
}

function applyFriendButtonState(button, status) {
  if (!button) return;

  button.hidden = false;
  button.disabled = false;
  button.dataset.friendState = status;

  switch (status) {
    case "self":
      button.hidden = true;
      button.disabled = true;
      button.textContent = "Your Profile";
      break;

    case "login_required":
      button.textContent = "Login to Add Friend";
      break;

    case "none":
      button.textContent = "Add Friend";
      break;

    case "outgoing_request":
      button.textContent = "Cancel Request";
      break;

    case "incoming_request":
      button.textContent = "Accept Request";
      break;

    case "friends":
      button.textContent = "Remove Friend";
      break;

    case "disabled":
      button.textContent = "Request Disabled";
      button.disabled = true;
      break;

    case "loading":
      button.textContent = "Loading...";
      button.disabled = true;
      break;

    default:
      button.textContent = "Add Friend";
      break;
  }
}

async function setupFriendSection({ me, profile }) {
  const button = document.getElementById("friendActionBtn");
  const friendsTitle = document.querySelector(".profile_friendlist h3");

  if (friendsTitle) {
    friendsTitle.textContent = `${profile.username}'s Friends:`;
  }

  async function loadFriendsOnly() {
    try {
      const friendsData = await api(`/api/friends/list/${encodeURIComponent(profile.username)}`);
      renderFriendsList(friendsData?.friends || []);
    } catch (err) {
      console.error(err);
      renderFriendsList([]);
    }
  }

  if (!button) {
    await loadFriendsOnly();
    return;
  }

  let currentStatus = "loading";
  let currentRequestId = null;
  let actionBusy = false;

  if (!me) {
    applyFriendButtonState(button, "login_required");

    button.addEventListener("click", () => {
      showLoginRequiredToast("Please log in to send friend requests.");
      redirectToLogin();
    });

    await loadFriendsOnly();
    return;
  }

  async function refreshFriendData() {
    applyFriendButtonState(button, "loading");

    const [statusData, friendsData] = await Promise.all([
      authApi(`/api/friends/status/${encodeURIComponent(profile.username)}`),
      api(`/api/friends/list/${encodeURIComponent(profile.username)}`)
    ]);

    currentStatus = statusData?.status || "none";
    currentRequestId = statusData?.requestId || null;

    const directRequestsAllowed = statusData?.directRequestsAllowed !== false;

    if (currentStatus === "none" && !directRequestsAllowed) {
      currentStatus = "disabled";
    }

    applyFriendButtonState(button, currentStatus);
    renderFriendsList(friendsData?.friends || []);
  }

  button.addEventListener("click", async () => {
    if (actionBusy) return;
    if (currentStatus === "self") return;
    if (currentStatus === "disabled") return;

    if (!getAccessToken()) {
      showLoginRequiredToast("Please log in to use friend actions.");
      redirectToLogin();
      return;
    }

    actionBusy = true;
    applyFriendButtonState(button, "loading");

    try {
      if (currentStatus === "none") {
        await authApi(`/api/friends/request/${encodeURIComponent(profile.username)}`, {
          method: "POST"
        });

        showToast({
          title: "Friend request sent",
          message: `Your request to ${profile.username} has been sent.`,
          type: "success"
        });
      } else if (currentStatus === "incoming_request") {
        if (!currentRequestId) throw new Error("Missing request id");

        await authApi(`/api/friends/request/${encodeURIComponent(currentRequestId)}/accept`, {
          method: "POST"
        });

        showToast({
          title: "Friend request accepted",
          message: `You are now friends with ${profile.username}.`,
          type: "success"
        });
      } else if (currentStatus === "outgoing_request") {
        const ok = await window.openMglConfirm({
          title: "Cancel Friend Request",
          text: `Do you want to cancel your friend request to ${profile.username}?`,
          confirmText: "Cancel Request",
          cancelText: "Keep"
        });

        if (!ok) {
          actionBusy = false;
          await refreshFriendData();
          return;
        }

        await authApi(`/api/friends/request/${encodeURIComponent(profile.username)}`, {
          method: "DELETE"
        });

        showToast({
          title: "Request cancelled",
          message: `Your request to ${profile.username} has been cancelled.`,
          type: "success"
        });
      } else if (currentStatus === "friends") {
        const ok = await window.openMglConfirm({
          title: "Remove Friend",
          text: `Do you really want to remove ${profile.username} from your friends list?`,
          confirmText: "Remove",
          cancelText: "Keep"
        });

        if (!ok) {
          actionBusy = false;
          await refreshFriendData();
          return;
        }

        await authApi(`/api/friends/remove/${encodeURIComponent(profile.username)}`, {
          method: "DELETE"
        });

        showToast({
          title: "Friend removed",
          message: `${profile.username} has been removed from your friends list.`,
          type: "success"
        });
      }

      await refreshFriendData();
    } catch (err) {
      console.error(err);

      if (err.message === "SESSION_EXPIRED" || err.message === "AUTH_REQUIRED") {
        showLoginRequiredToast("Please log in again to use friend actions.");
        redirectToLogin();
        return;
      }

      showToast({
        title: "Friend action failed",
        message: err.message || "Something went wrong.",
        type: "error"
      });

      await refreshFriendData();
    } finally {
      actionBusy = false;
    }
  });

  await refreshFriendData();
}

async function loadProfile() {
  const params = new URLSearchParams(window.location.search);
  const requestedUsername = params.get("username");

  const me = await loadCurrentUserOptional();

  if (!requestedUsername && !me?.username) {
    const usernameEl = qs(".profile_username");
    if (usernameEl) usernameEl.textContent = "Profile";

    showToast({
      title: "Profile unavailable",
      message: "Please open a public user profile or log in to view your own profile.",
      type: "info"
    });

    return;
  }

  const targetUsername = requestedUsername || me.username;

  const profile = await api(`/api/users/profile/${encodeURIComponent(targetUsername)}`);

  const resolvedProfileUsername = profile?.username || requestedUsername || me?.username;

  if (!resolvedProfileUsername) {
    console.error("Profile username missing", {
      me,
      profile,
      requestedUsername,
      targetUsername
    });

    throw new Error("Profile username missing");
  }

  if (!requestedUsername && resolvedProfileUsername) {
    const newUrl = `${window.location.pathname}?username=${encodeURIComponent(resolvedProfileUsername)}`;
    window.history.replaceState({}, "", newUrl);
  }

  if (me?.username) {
    const navProfileLinks = document.querySelectorAll('#userDropdown a[href*="profile.html"]');

    navProfileLinks.forEach(link => {
      link.href = `./profile.html?username=${encodeURIComponent(me.username)}`;
    });
  }

  const isOwner =
    Boolean(me?.username) &&
    resolvedProfileUsername.toLowerCase() === me.username.toLowerCase();

  const profileSettings = normalizeSettings(profile.settings);

  const profileVisibility = {
    ...(profile.visibility || {}),
    isFriend: profile?.visibility?.isFriend ?? false,
    publicProfile: profile?.visibility?.publicProfile ?? true,
    isOwner
  };

  const usernameEl = qs(".profile_username");
  if (usernameEl) usernameEl.textContent = resolvedProfileUsername;

  const descTitle = document.getElementById("playerDescriptionTitle");
  if (descTitle) {
    descTitle.textContent = `Description:`;
  }

  document.title = `${resolvedProfileUsername} | MyGameList`;

  const joinedEl = document.getElementById("joinedAt");
  if (joinedEl) joinedEl.textContent = `Joined: ${formatDate(profile.createdAt)}`;

  const lastEl = document.getElementById("lastOnline");
  if (lastEl) lastEl.textContent = `Last Online: ${formatDate(profile.lastLoginAt)}`;

  renderProfileSocialLinks(profileSettings);
  renderProfileBio(profileSettings);
  applyProfileVisibility(profileSettings, profileVisibility);
  applyCommentComposerVisibility(profileSettings, isOwner);

  let entries = [];

  try {
    const entriesData = await api(`/api/library/profile/${encodeURIComponent(resolvedProfileUsername)}`);
    entries = Array.isArray(entriesData) ? entriesData : [];
  } catch (err) {
    console.error("Profile library failed to load:", err);
    entries = [];

    showToast({
      title: "Library failed to load",
      message: err.message || "Could not load this user's public games.",
      type: "error"
    });
  }

  window.currentProfileUsername = resolvedProfileUsername;
  window.currentViewerUsername = me?.username || null;
  window.currentViewerIsLoggedIn = Boolean(me?.username);

  await loadProfileReviews(resolvedProfileUsername);

  const favWrap = document.getElementById("profileFavorites");

  if (favWrap) {
    favWrap.innerHTML = "";

    const top = [...entries]
      .filter(e => e?.isFavorite && e?.game?.coverImageId)
      .sort((a, b) => {
        const da = a?.favoriteAddedAt ? new Date(a.favoriteAddedAt).getTime() : 0;
        const db = b?.favoriteAddedAt ? new Date(b.favoriteAddedAt).getTime() : 0;
        return db - da;
      })
      .slice(0, 8);

    if (!top.length) {
      favWrap.innerHTML = `<div class="muted">No favorite games yet.</div>`;
    } else {
      for (const e of top) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "favourite_item";

        btn.innerHTML = `
          <div class="favourite_box">
            <span class="cover_shimmer" aria-hidden="true"></span>
            <img
              src="${coverUrl(e.game.coverImageId)}"
              class="favourite_icon"
              alt="${e.game.name || "Game Cover"}"
            >
          </div>
        `;

        btn.addEventListener("click", () => {
          window.location.href = `../gamepage/game.html?id=${encodeURIComponent(e.game.igdbId)}`;
        });

        favWrap.appendChild(btn);
      }
    }
  }

  renderRecentActivity(entries);

  const counts = entries.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {});

  if (typeof window.updateProfileChart === "function") {
    window.updateProfileChart(counts);
  }

  await setupFriendSection({ me, profile });
}

document.addEventListener("DOMContentLoaded", () => {
  loadProfile().catch(err => {
    console.error(err);

    showToast({
      title: "Profile failed to load",
      message: err.message || "Something went wrong while loading the profile.",
      type: "error"
    });
  });
});

window.addEventListener("mgl:settings-saved", () => {
  loadProfile().catch(err => {
    console.error(err);
  });
});