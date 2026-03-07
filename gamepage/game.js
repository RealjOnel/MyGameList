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

function characterImgUrls(imageId){
  if (!imageId) return null;
  const base = "https://images.igdb.com/igdb/image/upload";
  const size = "t_thumb"; 
  return {
    png: `${base}/${size}/${imageId}.png`,
    jpg: `${base}/${size}/${imageId}.jpg`
  };
}

async function loadGame(){
  const id = new URLSearchParams(location.search).get("id");
  if (!id) return;

  const res = await fetch(`${API_BASE_URL}/api/igdb/game/${encodeURIComponent(id)}`);
  const g = await res.json();
  if (!res.ok) throw new Error(g?.error || "Failed");

  // Title + Cover
  qs("gameTitle").textContent = g.name || "Unknown";
  document.title = `${g.name} | MGL`;

  const coverId = g?.cover?.image_id;
  qs("gameCover").src = coverId
    ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${coverId}.jpg`
    : "../assets/placeholder-cover.png";

// ===== Library controls (Add -> Status Dropdown, Rating Dropdown) =====
const token = localStorage.getItem("token");

const btnAdd = qs("btnAdd");
const statusDD = qs("statusDD");
const ratingDD = qs("ratingDD");
const btnReview = qs("btnReview");
const userControls = qs("userControls");

function ddParts(root){
  return {
    root,
    btn: root.querySelector(".mgl-dd-btn"),
    label: root.querySelector(".mgl-dd-label"),
    menu: root.querySelector(".mgl-dd-menu"),
    items: [...root.querySelectorAll(".mgl-dd-item")]
  };
}

function closeAllDropdowns(){
  document.querySelectorAll(".mgl-dd.open").forEach(x => {
    x.classList.remove("open");
    const b = x.querySelector(".mgl-dd-btn");
    if (b) b.setAttribute("aria-expanded", "false");
  });
}

function wireDropdown(root, onSelect){
  const p = ddParts(root);

  p.btn.addEventListener("click", (e) => {
    if (root.classList.contains("disabled")) return;
    e.stopPropagation();
    const isOpen = root.classList.toggle("open");
    p.btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  p.items.forEach(it => {
    it.addEventListener("click", (e) => {
    e.stopPropagation();
    const val = it.dataset.value;

    // close immediately
    root.classList.remove("open");
    p.btn.setAttribute("aria-expanded", "false");

    // then patch async
    onSelect(val).catch(console.error);
    });
  });

  return {
    setLabel: (txt) => { p.label.textContent = txt; },
    setActiveValue: (val) => {
      p.items.forEach(it => it.classList.toggle("active", it.dataset.value === String(val ?? "")));
    },
    setDisabled: (dis) => {
      root.classList.toggle("disabled", !!dis);
    }
  };
}

document.addEventListener("click", closeAllDropdowns);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAllDropdowns(); });

async function fetchEntry(){
  if (!token) return null;
  const r = await fetch(`${API_BASE_URL}/api/library/entry/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!r.ok) return null;
  const data = await r.json();
  return data?.entry || null;
}

async function patchEntry(patch){
  const r = await fetch(`${API_BASE_URL}/api/library/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(patch)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const statusUI = wireDropdown(statusDD, async (val) => {
  if (val === "__remove__") {
    const ok = window.confirm("Remove this game from your list?");
    if (!ok) return;

    try {
      const r = await fetch(`${API_BASE_URL}/api/library/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!r.ok) throw new Error(await r.text());

      await refreshControls(); // back to "+ Add to List"
      return;
    } catch (e) {
      console.error(e);
      await refreshControls();
      return;
    }
  }

  // normal status change (handled by PATCH)
  statusUI.setLabel(statusLabel(val));
  statusUI.setActiveValue(val);

  try {
    await patchEntry({ status: val });
  } catch (e) {
    console.error(e);
    await refreshControls(); // resync only on error
  }
});

const ratingUI = wireDropdown(ratingDD, async (val) => {
  const rating = val === "" ? null : Number(val);

  // label should be ONLY the number or "Your Rating"
  const rLabel = rating == null ? "Your Rating" : String(rating);
  ratingUI.setLabel(rLabel);
  ratingUI.setActiveValue(rating == null ? "" : String(rating));

  try {
    await patchEntry({ rating });
  } catch (e) {
    console.error(e);
    await refreshControls(); // only resync on error
  }
});

function statusLabel(v){
  return ({
    planned: "Planned",
    playing: "Currently Playing",
    completed: "Completed",
    dropped: "Dropped",
    on_hold: "On-Hold"
  })[v] || "Planned";
}

async function refreshControls(){
  // Default safe state
  btnAdd.hidden = false;
  btnAdd.disabled = false;
  statusDD.hidden = true;
  ratingDD.hidden = true;
  btnReview.disabled = true;

  // logged out -> show immediately (no flicker needed)
  if (!token){
    if (userControls) userControls.classList.remove("is-loading");
    btnAdd.textContent = "Login to add";
    return;
  }

  // logged in -> prevent flicker while loading entry
  if (userControls) userControls.classList.add("is-loading");

  const entry = await fetchEntry();

  if (userControls) userControls.classList.remove("is-loading");

  // not in list
  if (!entry){
    btnAdd.textContent = "+ Add to List";
    return;
  }

  // in list
  btnAdd.hidden = true;

  statusDD.hidden = false;
  ratingDD.hidden = false;

  statusUI.setLabel(statusLabel(entry.status));
  statusUI.setActiveValue(entry.status);

  const rLabel = entry.rating == null ? "Your Rating" : String(entry.rating);
  ratingUI.setLabel(rLabel);
  ratingUI.setActiveValue(entry.rating == null ? "" : String(entry.rating));

  btnReview.disabled = false;
}

btnAdd.addEventListener("click", async () => {
  if (!token){
    window.location.href = "../LoginPageAndLogic/login.html";
    return;
  }

  btnAdd.disabled = true;

  const r = await fetch(`${API_BASE_URL}/api/library/add`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ igdbId: Number(id), status: "planned" })
  });

  if (!r.ok){
    btnAdd.disabled = false;
    console.error("Add failed:", await r.text());
    return;
  }

  await refreshControls();
});

// Review placeholder (feature later)
btnReview.addEventListener("click", () => {
  console.log("Review feature later.");
});

await refreshControls();
if (userControls) userControls.classList.add("is-ready");

  // Studio (dev/publisher)
  const studio =
    g?.involved_companies?.find(c => c?.developer)?.company?.name ||
    g?.involved_companies?.find(c => c?.publisher)?.company?.name ||
    "Unknown Studio";

  const year = g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : "—";
  const rating = (typeof g.rating === "number") ? `${Math.round(g.rating)}` : "—";

    const userRating = "—"; // later: DB Rating (average of all users who added the game to their list)
    const mglRank = "—";    // Later: calculate rank based on user ratings (e.g. top 1000 games in the database)

    const meta = (typeof g.aggregated_rating === "number" && isFinite(g.aggregated_rating))
        ? `${Math.round(g.aggregated_rating)}`
        : "—";

    qs("gameStats").innerHTML = `
        <div class="stats-wrap">
            <div class="stats-left">
            <div class="stat">
                <span class="k">User Rating</span>
                <span class="v">${esc(userRating)}</span>
            </div>

            <div class="stat">
                <span class="k">Metacritic</span>
                <span class="v">${esc(meta)}</span>
            </div>

            <div class="stat stat-rank">
                <span class="k">MGL Rank</span>
                <span class="v">${esc(mglRank)}</span>
            </div>
            </div>

            <div class="stats-divider" aria-hidden="true"></div>

            <div class="stats-right">
            <div class="stat">
                <span class="k">Release</span>
                <span class="v">${esc(year)}</span>
            </div>

            <div class="stat">
                <span class="k">Studio</span>
                <span class="v">${esc(studio)}</span>
            </div>
            </div>
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
  function pickTrailerVideoId(videos, gameName){
    const list = Array.isArray(videos) ? videos : [];
    const nameNorm = (s) => String(s || "").toLowerCase();

    const GOOD = [
        /trailer/, /official/, /teaser/, /announcement/, /reveal/, /launch/, /release date/, /gameplay trailer/, /story trailer/
    ];
    const BAD = [
        /walkthrough/, /playthrough/, /let'?s play/, /longplay/, /\b100%\b/, /speedrun/, /full game/, /complete/, /no commentary/, /all bosses/, /ost/, /soundtrack/
    ];

    const gn = nameNorm(gameName);

    const scored = list
        .filter(v => v?.video_id)
        .map(v => {
            const n = nameNorm(v.name);
            let score = 0;

        if (GOOD.some(rx => rx.test(n))) score += 50;
        if (BAD.some(rx => rx.test(n))) score -= 100;

        // little extras
        if (n.includes("official")) score += 10;
        if (gn && n.includes(gn)) score += 5;

        return { id: v.video_id, score, name: v.name };
    })
    .sort((a,b) => b.score - a.score);

    // only take if its positively scored (heuristic to avoid wrong videos when no clear trailer is available)
    return scored[0]?.score > 0 ? scored[0].id : null;
    }

const vid = pickTrailerVideoId(g?.videos, g?.name);
  const trailerWrap = qs("trailerWrap");
  trailerWrap.innerHTML = vid
    ? `<iframe src="https://www.youtube-nocookie.com/embed/${esc(vid)}" title="Trailer" frameborder="0"
         allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
         allowfullscreen></iframe>`
    : `<div class="muted">No trailer available.</div>`;

  // Time to beat
  const ttb = g?.time_to_beat || {};
    qs("playtimeBox").innerHTML = `
        <div class="pt-row"><span>Main</span><b>${fmtHours(ttb.hastily)}</b></div>
        <div class="pt-row"><span>Main + Extras</span><b>${fmtHours(ttb.normally)}</b></div>
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

  // Characters (from backend: g.characters)
  const chars = Array.isArray(g.characters) ? g.characters : [];
  const grid = document.getElementById("charactersGrid");
  const count = document.getElementById("charactersCount");

  if (count) count.textContent = `${chars.length} found`;

  if (grid){
    if (!chars.length){
      grid.innerHTML = `<div class="muted">No characters found.</div>`;
    } else {
      grid.innerHTML = chars.map(c => {
        const name = c?.name || "Unknown";
        const urls = characterImgUrls(c?.mug_shot?.image_id);
        const initial = name.trim().slice(0,1).toUpperCase() || "?";

        // We render an <img> only if we have an imageId
        const media = urls
          ? `<div class="char-media">
              <img class="char-img" src="${urls.png}" data-fallback="${urls.jpg}" alt="${esc(name)}" loading="lazy">
            </div>`
          : `<div class="char-media">
              <div class="char-fallback" aria-hidden="true">${esc(initial)}</div>
            </div>`;

        return `
          <div class="char-card">
            ${media}
            <div class="char-name">${esc(name)}</div>
          </div>
        `;
      }).join("");

      // attach robust fallback: png -> jpg -> fallback letter
      grid.querySelectorAll("img[data-fallback]").forEach(img => {
        img.addEventListener("error", () => {
          const fb = img.dataset.fallback;
          if (fb){
            img.dataset.fallback = "";     // prevent loop
            img.src = fb;                  // try jpg
            return;
          }
          // jpg also failed -> replace with fallback block
          const media = img.closest(".char-media");
          if (media){
            const name = img.alt || "?"
            const initial = name.trim().slice(0,1).toUpperCase() || "?";
            media.innerHTML = `<div class="char-fallback" aria-hidden="true">${esc(initial)}</div>`;
          }
        });
      });
    } 
  }

  // ===== Tabs (About / Community / Characters / Related) =====
function imgIGDB(imageId, size = "t_cover_big"){
  return imageId
    ? `https://images.igdb.com/igdb/image/upload/${size}/${imageId}.jpg`
    : "../assets/placeholder-cover.png";
}

function uniq(arr){
  return [...new Set(arr.filter(Boolean))];
}

function devPubLists(involved){
  const list = Array.isArray(involved) ? involved : [];
  const devs = uniq(list.filter(x => x?.developer).map(x => x?.company?.name));
  const pubs = uniq(list.filter(x => x?.publisher).map(x => x?.company?.name));
  return { devs, pubs };
}

function chipsHtml(items){
  const a = (items || []).filter(Boolean);
  if (!a.length) return `<span class="muted">—</span>`;
  return a.map(x => `<span class="chip">${esc(x)}</span>`).join("");
}

function gameCard(gm){
  const id = gm?.id;
  const name = gm?.name || "Unknown";
  const coverId = gm?.cover?.image_id;
  return `
    <button class="mini-card" type="button" data-gid="${esc(id)}">
      <div class="mini-cover"><img src="${imgIGDB(coverId)}" alt=""></div>
      <div class="mini-title">${esc(name)}</div>
    </button>
  `;
}

function wireMiniCardClicks(root){
  root.querySelectorAll(".mini-card").forEach(btn => {
    btn.addEventListener("click", () => {
      const gid = btn.getAttribute("data-gid");
      if (!gid) return;
      window.location.href = `./game.html?id=${encodeURIComponent(gid)}`;
    });
  });
}

function renderAboutTab(game){
  const about = qs("panel-about");
  if (!about) return;

  const { devs, pubs } = devPubLists(game?.involved_companies);

  const modes = (game?.game_modes || []).map(x => x?.name);
  const themes = (game?.themes || []).map(x => x?.name);
  const pers = (game?.player_perspectives || []).map(x => x?.name);
  const kws = (game?.keywords || []).map(x => x?.name).slice(0, 18);

  const franchise = game?.franchise?.name;
  const collection = game?.collection?.name;

  const websites = Array.isArray(game?.websites) ? game.websites : [];
  const websiteHtml = websites.length
    ? websites.slice(0, 10).map(w => {
        const url = w?.url;
        if (!url) return "";
        const host = (() => { try { return new URL(url).hostname.replace("www.",""); } catch { return url; } })();
        return `<a class="site-link" href="${esc(url)}" target="_blank" rel="noreferrer">${esc(host)}</a>`;
      }).join("")
    : `<span class="muted">No websites.</span>`;

  about.innerHTML = `
    <div class="sub-grid">
      <div class="sub-card">
        <h4>Main Developers</h4>
        <div class="sub-body">${chipsHtml(devs)}</div>
      </div>

      <div class="sub-card">
        <h4>Publishers</h4>
        <div class="sub-body">${chipsHtml(pubs)}</div>
      </div>

      <div class="sub-card">
        <h4>Game Modes</h4>
        <div class="sub-body">${chipsHtml(modes)}</div>
      </div>

      <div class="sub-card">
        <h4>Player Perspectives</h4>
        <div class="sub-body">${chipsHtml(pers)}</div>
      </div>

      <div class="sub-card">
        <h4>Themes</h4>
        <div class="sub-body">${chipsHtml(themes)}</div>
      </div>

      <div class="sub-card">
        <h4>Franchise / Collection</h4>
        <div class="sub-body">
          ${franchise ? `<div><b>Franchise:</b> ${esc(franchise)}</div>` : `<div class="muted">Franchise: —</div>`}
          ${collection ? `<div><b>Collection:</b> ${esc(collection)}</div>` : `<div class="muted">Collection: —</div>`}
        </div>
      </div>

      <div class="sub-card sub-card-wide">
        <h4>Websites</h4>
        <div class="sub-links">${websiteHtml}</div>
      </div>

      <div class="sub-card sub-card-wide">
        <h4>Keywords</h4>
        <div class="sub-body">${chipsHtml(kws)}</div>
      </div>
    </div>
  `;
}

function renderCommunityTab(){
  const c = qs("panel-community");
  if (!c) return;
  c.innerHTML = `
    <div class="sub-empty">
      <h4>Community</h4>
      <p class="muted">Reviews & forums will live here. For now: Placeholder content.</p>
    </div>
  `;
}

function renderCharactersTab(game){
  const el = qs("panel-characters");
  if (!el) return;

  const chars = Array.isArray(game?.characters) ? game.characters : [];
  if (!chars.length){
    el.innerHTML = `<div class="sub-empty"><h4>Characters</h4><p class="muted">No character data available.</p></div>`;
    return;
  }

  const items = chars.slice(0, 30).map(ch => {
    const name = ch?.name || "Unknown";
    const mug = ch?.mug_shot?.image_id;
    const img = mug ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${mug}.jpg` : "../assets/placeholder-cover.png";
    return `
      <div class="char-card">
        <div class="char-pic"><img src="${img}" alt=""></div>
        <div class="char-name">${esc(name)}</div>
      </div>
    `;
  }).join("");

  el.innerHTML = `
    <div class="sub-head">
      <h4>Characters</h4>
      <div class="muted">${chars.length} found</div>
    </div>
    <div class="char-grid">${items}</div>
  `;
}

function renderRelatedTab(game){
  const el = qs("panel-related");
  if (!el) return;

  const parent = game?.parent_game && (game.parent_game?.id || game.parent_game) ? game.parent_game : null;
  const vparent = game?.version_parent && (game.version_parent?.id || game.version_parent) ? game.version_parent : null;

  const similar = Array.isArray(game?.similar_games) ? game.similar_games : [];
  const dlcs = Array.isArray(game?.dlcs) ? game.dlcs : [];
  const exps = Array.isArray(game?.expansions) ? game.expansions : [];
  const remakes = Array.isArray(game?.remakes) ? game.remakes : [];
  const remasters = Array.isArray(game?.remasters) ? game.remasters : [];
  const ports = Array.isArray(game?.ports) ? game.ports : [];

  const blocks = [];

  if (vparent?.id){
    blocks.push(`
      <div class="sub-block">
        <div class="sub-title">This is an edition of</div>
        <div class="mini-grid">${gameCard(vparent)}</div>
      </div>
    `);
  } else if (parent?.id){
    blocks.push(`
      <div class="sub-block">
        <div class="sub-title">Parent Game</div>
        <div class="mini-grid">${gameCard(parent)}</div>
      </div>
    `);
  }

  if (similar.length){
    blocks.push(`
      <div class="sub-block">
        <div class="sub-title">Similar Games</div>
        <div class="mini-grid">${similar.slice(0, 12).map(gameCard).join("")}</div>
      </div>
    `);
  }

  const addPack = (title, arr) => {
    if (!arr.length) return;
    blocks.push(`
      <div class="sub-block">
        <div class="sub-title">${esc(title)}</div>
        <div class="mini-grid">${arr.slice(0, 12).map(gameCard).join("")}</div>
      </div>
    `);
  };

  addPack("DLCs", dlcs);
  addPack("Expansions", exps);
  addPack("Remakes", remakes);
  addPack("Remasters", remasters);
  addPack("Ports", ports);

  if (!blocks.length){
    el.innerHTML = `<div class="sub-empty"><h4>Related Games</h4><p class="muted">No related data available.</p></div>`;
    return;
  }

  el.innerHTML = `<div class="related-wrap">${blocks.join("")}</div>`;
  wireMiniCardClicks(el);
}

function initTabs(){
  const tabs = document.querySelectorAll(".g-tab");
  const panels = {
    about: qs("panel-about"),
    community: qs("panel-community"),
    characters: qs("panel-characters"),
    related: qs("panel-related"),
  };

  function setActive(key){
    tabs.forEach(t => {
      const on = t.dataset.tab === key;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    Object.entries(panels).forEach(([k, p]) => p && p.classList.toggle("active", k === key));
  }

  tabs.forEach(t => {
    t.addEventListener("click", () => {
      setActive(t.dataset.tab);
    });
  });

  setActive("about");
}

// render + wire
renderAboutTab(g);
renderCommunityTab();
renderCharactersTab(g);
renderRelatedTab(g);
initTabs();
}

document.addEventListener("DOMContentLoaded", () => {
  loadGame().catch(err => {
    console.error(err);
    qs("gameTitle").textContent = "Could not load game.";
  });
});