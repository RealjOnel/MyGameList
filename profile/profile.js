import { API_BASE_URL } from "../../backend/config.js";

function qs(sel){ return document.querySelector(sel); }

async function api(path, { token, method="GET", body } = {}){
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store" 
    });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Request failed");
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

async function loadProfile(){
  const token = localStorage.getItem("token");
  if (!token){
    // not logged in -> redirect or show a message
    window.location.href = "../../LoginPageAndLogic/login.html";
    return;
  }

  // 1) who am I
  const me = await api("/api/users/me", { token });

  // 2) my library
  const entries = await api("/api/library/me", { token });

  // ---- render basics ----
  qs(".profile_username").textContent = me.username;

  // joined date placeholder
  const joinedEl = document.getElementById("joinedAt");
  if (joinedEl) joinedEl.textContent = `Joined: ${formatDate(me.createdAt)}`;

  // ---- favorites (placeholder logic for now) ----
  // Until you have a "favorite" flag, just show top-rated or most recent entries:
  const favWrap = document.querySelector(".profile_favourites_items");
  if (favWrap){
    favWrap.innerHTML = "";

    const top = [...entries]
      .filter(e => e?.game?.coverImageId)
      .sort((a,b) => (b.rating ?? -1) - (a.rating ?? -1))
      .slice(0, 8);

    for (const e of top){
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "favourite_item";
      btn.innerHTML = `
        <img src="${coverUrl(e.game.coverImageId)}" class="favourite_icon" alt="">
        <span class="favourite_name">${e.game.name}</span>
      `;
      btn.addEventListener("click", () => {
        window.location.href = `../gamepage/game.html?id=${encodeURIComponent(e.game.igdbId)}`;
      });
      favWrap.appendChild(btn);
    }
  }

  // ---- pie chart stats ----
  // Use your existing piechart.js, just feed it counts by status later.
  // Example counts:
  const counts = entries.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {});
  console.log("status counts", counts);

  // Later: call your pie chart render function with these counts.
}

document.addEventListener("DOMContentLoaded", () => {
  loadProfile().catch(err => console.error(err));
});