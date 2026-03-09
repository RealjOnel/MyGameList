import { API_BASE_URL } from "../backend/config.js";

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

async function loadProfile(){
  const token = localStorage.getItem("token");
  if (!token){
    window.location.href = "../../LoginPageAndLogic/login.html";
    return;
  }

  const me = await api("/api/users/me", { token });
  const entries = await api("/api/library/me", { token });

  qs(".profile_username").textContent = me.username;
  document.title = `${me.username || "Profile"} | MyGameList`;

  const joinedEl = document.getElementById("joinedAt");
  if (joinedEl) joinedEl.textContent = `Joined: ${formatDate(me.createdAt)}`;

  const lastEl = document.getElementById("lastOnline");
  if (lastEl) lastEl.textContent = `Last Online: ${formatDate(me.lastLoginAt)}`;

  // Favorites
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

  // Recent Activity
  renderRecentActivity(entries);

  // Pie chart counts
  const counts = entries.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {});
  console.log("status counts", counts);

  // later: render pie chart based on counts
}

document.addEventListener("DOMContentLoaded", () => {
  loadProfile().catch(err => console.error(err));
});