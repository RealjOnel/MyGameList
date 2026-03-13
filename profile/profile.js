import { API_BASE_URL } from "../backend/config.js";
import { showToast } from "../js/global/toast.js";

function qs(sel){ return document.querySelector(sel); }

async function api(path, { token, method = "GET", body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";

  const url =
    method === "GET"
      ? `${API_BASE_URL}${path}${path.includes("?") ? "&" : "?"}_=${Date.now()}`
      : `${API_BASE_URL}${path}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    throw new Error(data?.message || `Request failed (${res.status})`);
  }
  return data;
}

function coverUrl(coverImageId){
  return coverImageId
    ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${coverImageId}.jpg`
    : "../../assets/placeholder-cover.png";
}

function avatarUrl(avatar){
  return avatar || "../assets/User/Default_User_Icon.png";
}

function formatDate(iso){
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB");
}

function formatDateTime(iso){
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function statusLabel(status){
  return ({
    playing: "Currently Playing",
    planned: "Planned",
    completed: "Completed",
    on_hold: "On Hold",
    dropped: "Dropped"
  })[status] || "Unknown";
}

function statusClass(status){
  return ({
    playing: "pg_state_playing",
    planned: "pg_state_planed",
    completed: "pg_state_completed",
    on_hold: "pg_state_onhold",
    dropped: "pg_state_dropped"
  })[status] || "pg_state";
}

function renderRecentActivity(items){
  const wrap = document.getElementById("recentActivityWrap");
  if (!wrap) return;

  wrap.innerHTML = "";

  const recent = [...items]
    .filter(e => e?.game)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 4);

  if (!recent.length){
    wrap.innerHTML = `<div class="muted">No recent activity yet.</div>`;
    return;
  }

  for (const e of recent){
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

function renderFriendsList(friends = []){
  const wrap = document.getElementById("profileFriendsList");
  if (!wrap) return;

  wrap.innerHTML = "";

  if (!friends.length){
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

function applyFriendButtonState(button, status){
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

    case "loading":
      button.textContent = "Loading...";
      button.disabled = true;
      break;

    default:
      button.textContent = "Add Friend";
      break;
  }
}

async function setupFriendSection({ token, me, profile }) {
  const button = document.getElementById("friendActionBtn");
  const friendsTitle = document.querySelector(".profile_friendlist h3");

  if (friendsTitle) {
    friendsTitle.textContent = `${profile.username}'s Friends:`;
  }

  if (!button) return;

  let currentStatus = "loading";
  let currentRequestId = null;
  let actionBusy = false;

  async function refreshFriendData() {
    applyFriendButtonState(button, "loading");

    const [statusData, friendsData] = await Promise.all([
      api(`/api/friends/status/${encodeURIComponent(profile.username)}`, { token }),
      api(`/api/friends/list/${encodeURIComponent(profile.username)}`, { token }),
    ]);

    currentStatus = statusData?.status || "none";
    currentRequestId = statusData?.requestId || null;

    applyFriendButtonState(button, currentStatus);
    renderFriendsList(friendsData?.friends || []);
  }

  button.addEventListener("click", async () => {
    if (actionBusy) return;
    if (currentStatus === "self") return;

    actionBusy = true;
    applyFriendButtonState(button, "loading");

    try {
      if (currentStatus === "none") {
        await api(`/api/friends/request/${encodeURIComponent(profile.username)}`, {
          method: "POST",
          token,
        });

        showToast({
          title: "Friend request sent",
          message: `Your request to ${profile.username} has been sent.`,
          type: "success"
        });
      }

      else if (currentStatus === "incoming_request") {
        if (!currentRequestId) {
          throw new Error("Missing request id");
        }

        await api(`/api/friends/request/${encodeURIComponent(currentRequestId)}/accept`, {
          method: "POST",
          token,
        });

        showToast({
          title: "Friend request accepted",
          message: `You are now friends with ${profile.username}.`,
          type: "success"
        });
      }

      else if (currentStatus === "outgoing_request") {
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

        await api(`/api/friends/request/${encodeURIComponent(profile.username)}`, {
          method: "DELETE",
          token,
        });

        showToast({
          title: "Request cancelled",
          message: `Your request to ${profile.username} has been cancelled.`,
          type: "success"
        });
      }

      else if (currentStatus === "friends") {
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

        await api(`/api/friends/remove/${encodeURIComponent(profile.username)}`, {
          method: "DELETE",
          token,
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

async function loadProfile(){
  const token = localStorage.getItem("token");
  if (!token){
    window.location.href = "../../LoginPageAndLogic/login.html";
    return;
  }

  const me = await api("/api/users/me", { token });

  const params = new URLSearchParams(window.location.search);
  const profileUsername = params.get("username");

  let profile;

  if (profileUsername) {
    profile = await api(`/api/users/profile/${encodeURIComponent(profileUsername)}`, { token });
  } else {
    profile = me;
  }

  if (!profileUsername && profile?.username) {
    const newUrl = `${window.location.pathname}?username=${encodeURIComponent(profile.username)}`;
    window.history.replaceState({}, "", newUrl);
  }

  const navProfileLinks = document.querySelectorAll('a[href="./profile.html"]');
  navProfileLinks.forEach(link => {
    link.href = `./profile.html?username=${encodeURIComponent(me.username)}`;
  });

  const entries = await api(
    `/api/library/profile/${encodeURIComponent(profile.username)}`,
    { token }
  );

  window.currentProfileUsername = profile.username;
  window.currentViewerUsername = me.username;

  qs(".profile_username").textContent = profile.username;

  const descTitle = document.getElementById("playerDescriptionTitle");
  if (descTitle) {
    descTitle.textContent = `${profile.username}'s Description:`;
  }

  document.title = `${profile.username || "Profile"} | MyGameList`;

  const joinedEl = document.getElementById("joinedAt");
  if (joinedEl) joinedEl.textContent = `Joined: ${formatDate(profile.createdAt)}`;

  const lastEl = document.getElementById("lastOnline");
  if (lastEl) lastEl.textContent = `Last Online: ${formatDate(profile.lastLoginAt)}`;

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

  const commentHeading = document.querySelector(".profile_comments h3");
  if (commentHeading) {
    commentHeading.textContent =
      profile.username === me.username
        ? "Leave a Comment"
        : `Leave a Comment for ${profile.username}`;
  }

  await setupFriendSection({ token, me, profile });
}

document.addEventListener("DOMContentLoaded", () => {
  loadProfile().catch(err => console.error(err));
});