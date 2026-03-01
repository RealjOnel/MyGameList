import { API_BASE_URL } from "../backend/config.js";

function qs(id){ return document.getElementById(id); }
function esc(str){ return String(str ?? "").replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m])); }

function fmtDate(unix){
  if (!unix) return "—";
  return new Intl.DateTimeFormat("en-GB", { year:"numeric", month:"short", day:"2-digit" })
    .format(new Date(unix * 1000));
}

function fmtHours(seconds){
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const h = Math.round((seconds / 3600) * 10) / 10;
  return `${h}h`;
}

function chip(text){
  const d = document.createElement("span");
  d.className = "chip";
  d.textContent = text;
  return d;
}

async function loadGame(){
  const id = new URLSearchParams(location.search).get("id");
  if (!id) return;

  const res = await fetch(`${API_BASE_URL}/api/igdb/game/${encodeURIComponent(id)}`);
  const g = await res.json();
  if (!res.ok) throw new Error(g?.error || "Failed");

  // Title + Cover
  qs("gameTitle").textContent = g.name || "Unknown";
  document.title = `${g.name} | MyGameList`;

  const coverId = g?.cover?.image_id;
  qs("gameCover").src = coverId
    ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${coverId}.jpg`
    : "../assets/placeholder-cover.png";

  // Studio (dev/publisher)
  const studio =
    g?.involved_companies?.find(c => c?.developer)?.company?.name ||
    g?.involved_companies?.find(c => c?.publisher)?.company?.name ||
    "Unknown Studio";

  const year = g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : "—";
  const rating = (typeof g.rating === "number") ? `${Math.round(g.rating)}` : "—";

  qs("gameStats").innerHTML = `
    <div class="stat-row">
      <div class="stat"><span class="k">Rating</span><span class="v">${esc(rating)}</span></div>
      <div class="stat"><span class="k">Release</span><span class="v">${esc(year)}</span></div>
      <div class="stat"><span class="k">Studio</span><span class="v">${esc(studio)}</span></div>
      <div class="stat"><span class="k">Ranking</span><span class="v">—</span></div>
    </div>
  `;

  // Description
  qs("gameDescription").textContent = g.summary || g.storyline || "No description available.";

  // Genres
  const genres = (g.genres || []).map(x => x?.name).filter(Boolean);
  const genreWrap = qs("genreChips");
  genreWrap.innerHTML = "";
  (genres.length ? genres : ["—"]).forEach(t => genreWrap.appendChild(chip(t)));

  // Platforms
  const plats = (g.platforms || []).map(x => x?.name).filter(Boolean);
  const platWrap = qs("platformChips");
  platWrap.innerHTML = "";
  (plats.length ? plats : ["—"]).forEach(t => platWrap.appendChild(chip(t)));

  // Trailer (YouTube ID)
  const vid = g?.videos?.[0]?.video_id;
  const trailerWrap = qs("trailerWrap");
  trailerWrap.innerHTML = vid
    ? `<iframe src="https://www.youtube-nocookie.com/embed/${esc(vid)}" title="Trailer" frameborder="0"
         allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
         allowfullscreen></iframe>`
    : `<div class="muted">No trailer available.</div>`;

  // Time to beat
  const ttb = g?.time_to_beat || {};
  qs("playtimeBox").innerHTML = `
    <div class="pt-row"><span>Main</span><b>${fmtHours(ttb.normally)}</b></div>
    <div class="pt-row"><span>Extra</span><b>${fmtHours(ttb.hastily)}</b></div>
    <div class="pt-row"><span>Completionist</span><b>${fmtHours(ttb.completely)}</b></div>
  `;

  // Releases grouped by platform
  const rds = Array.isArray(g.release_dates) ? g.release_dates : [];
  const grouped = new Map();
  for (const r of rds){
    const p = r?.platform?.name;
    if (!p) continue;
    const arr = grouped.get(p) || [];
    arr.push(r);
    grouped.set(p, arr);
  }

  const relWrap = qs("releaseList");
  if (!grouped.size){
    relWrap.innerHTML = `<div class="muted">No release data.</div>`;
  } else {
    const platformsSorted = [...grouped.keys()].sort((a,b)=>a.localeCompare(b));
    relWrap.innerHTML = platformsSorted.map(p => {
      const dates = grouped.get(p)
        .map(x => x?.date)
        .filter(Boolean)
        .sort((a,b)=>a-b);
      const first = dates[0];
      return `<div class="rel-row"><span>${esc(p)}</span><b>${esc(fmtDate(first))}</b></div>`;
    }).join("");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadGame().catch(err => {
    console.error(err);
    qs("gameTitle").textContent = "Could not load game.";
  });
});