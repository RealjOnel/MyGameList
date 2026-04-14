import { API_BASE_URL } from "../backend/config.js";
import { fetchWithAuth, clearAccessToken, getAccessToken } from "../js/global/authClient.js";

function qs(id){ return document.getElementById(id); }
function esc(str){ return String(str ?? "").replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m])); }

function redirectToLogin(){
  window.location.href = "../LoginPageAndLogic/login.html";
}

async function apiAuth(path, { method = "GET", body } = {}) {
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

  qs("gameTitle").textContent = g.name || "Unknown";
  document.title = `${g.name} | MGL`;

  window.dispatchEvent(new CustomEvent("mgl:game-loaded", {
    detail: { game: g }
  }));

  const coverId = g?.cover?.image_id;
  qs("gameCover").src = coverId
    ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${coverId}.jpg`
    : "../assets/placeholder-cover.png";

  // ===== Library controls =====
  const btnAdd = qs("btnAdd");
  function setAddButtonLabel(text){
    const lab = btnAdd.querySelector(".mgl-dd-label");
    if (lab) lab.textContent = text;
    else btnAdd.textContent = text;
  }

  const statusDD = qs("statusDD");
  const ratingDD = qs("ratingDD");
  const btnReview = qs("btnReview");
  const userControls = qs("userControls");
  const btnFavorite = qs("btnFavorite");

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

        root.classList.remove("open");
        p.btn.setAttribute("aria-expanded", "false");

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
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllDropdowns();
  });

  async function fetchEntry(){
    if (!getAccessToken()) return null;

    try {
      const data = await apiAuth(`/api/library/entry/${encodeURIComponent(id)}`);
      return data?.entry || null;
    } catch (err) {
      if (err.message === "SESSION_EXPIRED") {
        redirectToLogin();
        return null;
      }
      console.error(err);
      return null;
    }
  }

  async function patchEntry(patch){
    return apiAuth(`/api/library/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: patch
    });
  }

  function statusLabel(v){
    return ({
      planned: "Planned",
      playing: "Currently Playing",
      completed: "Completed",
      dropped: "Dropped",
      on_hold: "On-Hold"
    })[v] || "Planned";
  }

  const statusUI = wireDropdown(statusDD, async (val) => {
    if (val === "__remove__") {
      const ok = await window.openMglConfirm({
        title: "Remove Game",
        text: "Do you really want to remove this game from your list?",
        confirmText: "Remove",
        cancelText: "Cancel",
      });

      if (!ok) return;

      try {
        await apiAuth(`/api/library/${encodeURIComponent(id)}`, {
          method: "DELETE"
        });

        await refreshControls();
        return;
      } catch (e) {
        if (e.message === "SESSION_EXPIRED") {
          redirectToLogin();
          return;
        }
        console.error(e);
        await refreshControls();
        return;
      }
    }

    statusUI.setLabel(statusLabel(val));
    statusUI.setActiveValue(val);

    try {
      await patchEntry({ status: val });
    } catch (e) {
      if (e.message === "SESSION_EXPIRED") {
        redirectToLogin();
        return;
      }
      console.error(e);
      await refreshControls();
    }
  });

  const ratingUI = wireDropdown(ratingDD, async (val) => {
    const rating = val === "" ? null : Number(val);

    const rLabel = rating == null ? "Your Rating" : String(rating);
    ratingUI.setLabel(rLabel);
    ratingUI.setActiveValue(rating == null ? "" : String(rating));

    try {
      await patchEntry({ rating });
    } catch (e) {
      if (e.message === "SESSION_EXPIRED") {
        redirectToLogin();
        return;
      }
      console.error(e);
      await refreshControls();
    }
  });

  async function refreshControls(){
    btnAdd.hidden = false;
    btnAdd.disabled = false;
    statusDD.hidden = true;
    ratingDD.hidden = true;
    btnReview.disabled = true;

    if (btnFavorite) {
      btnFavorite.hidden = true;
      btnFavorite.disabled = true;
      btnFavorite.textContent = "♡ Favorite";
      btnFavorite.classList.remove("active");
    }

    if (!getAccessToken()){
      if (userControls) userControls.classList.remove("is-loading");
      setAddButtonLabel("Login to add");
      return;
    }

    if (userControls) userControls.classList.add("is-loading");

    const entry = await fetchEntry();

    if (userControls) userControls.classList.remove("is-loading");

    if (btnFavorite) {
      btnFavorite.hidden = false;
      btnFavorite.disabled = !entry;
    }

    if (!entry){
      setAddButtonLabel("+ Add to List");
      if (btnFavorite) {
        btnFavorite.textContent = "♡ Favorite";
        btnFavorite.classList.remove("active");
      }
      return;
    }

    btnAdd.hidden = true;
    statusDD.hidden = false;
    ratingDD.hidden = false;

    statusUI.setLabel(statusLabel(entry.status));
    statusUI.setActiveValue(entry.status);

    const rLabel = entry.rating == null ? "Your Rating" : String(entry.rating);
    ratingUI.setLabel(rLabel);
    ratingUI.setActiveValue(entry.rating == null ? "" : String(entry.rating));

    btnReview.disabled = false;

    if (btnFavorite) {
      const fav = !!entry.isFavorite;
      btnFavorite.disabled = false;
      btnFavorite.textContent = fav ? "♥ Favorite" : "♡ Favorite";
      btnFavorite.classList.toggle("active", fav);
    }
  }

  btnAdd.addEventListener("click", async () => {
    if (!getAccessToken()){
      redirectToLogin();
      return;
    }

    btnAdd.disabled = true;

    try {
      await apiAuth("/api/library/add", {
        method: "POST",
        body: { igdbId: Number(id), status: "planned" }
      });

      await refreshControls();
    } catch (err) {
      btnAdd.disabled = false;

      if (err.message === "SESSION_EXPIRED") {
        redirectToLogin();
        return;
      }

      console.error("Add failed:", err);
    }
  });

  if (btnFavorite) {
    btnFavorite.addEventListener("click", async () => {
      if (!getAccessToken()) {
        redirectToLogin();
        return;
      }

      const entry = await fetchEntry();

      if (!entry) {
        alert("Add the game to your list first.");
        return;
      }

      const nextFav = !entry.isFavorite;

      btnFavorite.disabled = true;
      btnFavorite.textContent = nextFav ? "♥ Favorite" : "♡ Favorite";
      btnFavorite.classList.toggle("active", nextFav);

      try {
        await patchEntry({ isFavorite: nextFav });
      } catch (e) {
        if (e.message === "SESSION_EXPIRED") {
          redirectToLogin();
          return;
        }
        console.error("Favorite update failed:", e);
        await refreshControls();
        return;
      } finally {
        btnFavorite.disabled = false;
      }
    });
  }

  await refreshControls();
  if (userControls) userControls.classList.add("is-ready");

  // ===== Game info =====
  const studio =
    g?.involved_companies?.find(c => c?.developer)?.company?.name ||
    g?.involved_companies?.find(c => c?.publisher)?.company?.name ||
    "Unknown Studio";

  const year = g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : "—";

  const userRating = "—";
  const mglRank = "—";

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

  qs("gameDescription").textContent = g.summary || g.storyline || "No description available.";

  const genres = (g.genres || []).map(x => x?.name).filter(Boolean);
  const genreWrap = qs("genreChips");
  genreWrap.innerHTML = "";
  (genres.length ? genres : ["—"]).forEach(t => genreWrap.appendChild(chip(t)));

  const plats = (g.platforms || []).map(x => x?.name).filter(Boolean);
  const platWrap = qs("platformChips");
  platWrap.innerHTML = "";
  (plats.length ? plats : ["—"]).forEach(t => platWrap.appendChild(chip(t)));

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

        if (n.includes("official")) score += 10;
        if (gn && n.includes(gn)) score += 5;

        return { id: v.video_id, score, name: v.name };
      })
      .sort((a,b) => b.score - a.score);

    return scored[0]?.score > 0 ? scored[0].id : null;
  }

  const vid = pickTrailerVideoId(g?.videos, g?.name);
  const trailerWrap = qs("trailerWrap");
  trailerWrap.innerHTML = vid
    ? `<iframe src="https://www.youtube-nocookie.com/embed/${esc(vid)}" title="Trailer" frameborder="0"
         allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
         allowfullscreen></iframe>`
    : `<div class="muted">No trailer available.</div>`;

  const ttb = g?.time_to_beat || {};
  qs("playtimeBox").innerHTML = `
    <div class="pt-row"><span>Main</span><b>${fmtHours(ttb.hastily)}</b></div>
    <div class="pt-row"><span>Main + Extras</span><b>${fmtHours(ttb.normally)}</b></div>
    <div class="pt-row"><span>Completionist</span><b>${fmtHours(ttb.completely)}</b></div>
  `;

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

  // ===== Tabs =====
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

  function normalizeRatingCoverUrl(rawUrl){
    const url = String(rawUrl || "").trim();
    if (!url) return "";
    if (url.startsWith("//")) return `https:${url}`;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("/")) return `https://images.igdb.com${url}`;
    return `https://${url}`;
  }

  function getAgeRatingSystemId(item){
    const raw = item?.organization ?? item?.category;
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
  }

  function getAgeRatingValueId(item){
    const raw = item?.rating_category ?? item?.rating;
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
  }

  function getAgeRatingSystemSlug(systemId){
    const map = {
      1: "esrb",
      2: "pegi",
      3: "cero",
      4: "usk",
      5: "grac",
      6: "classind",
      7: "acb"
    };
    return map[Number(systemId)] || "";
  }

  function ratingSystemLabel(systemId){
    const map = {
      1: "ESRB",
      2: "PEGI",
      3: "CERO",
      4: "USK",
      5: "GRAC",
      6: "CLASSIND",
      7: "ACB"
    };
    return map[Number(systemId)] || "Rating";
  }

  function legacyRatingValueLabel(valueId){
    const map = {
      1: "3",
      2: "7",
      3: "12",
      4: "16",
      5: "18",

      6: "RP",
      7: "EC",
      8: "E",
      9: "E10+",
      10: "T",
      11: "M",
      12: "AO",

      13: "A",
      14: "B",
      15: "C",
      16: "D",
      17: "Z",

      18: "0",
      19: "6",
      20: "12",
      21: "16",
      22: "18",

      23: "ALL",
      24: "12",
      25: "15",
      26: "18",

      27: "TESTING",
      28: "L",
      29: "10",
      30: "12",
      31: "14",
      32: "16",
      33: "18",

      34: "G",
      35: "PG",
      36: "M",
      37: "MA15+",
      38: "R18+",
      39: "RC"
    };

    return map[Number(valueId)] || null;
  }

  function normalizeDisplayValue(rawValue, systemId){
    if (!rawValue) return null;

    let value = String(rawValue).trim().toUpperCase();

    value = value
      .replace(/^ESRB\s+/i, "")
      .replace(/^PEGI\s+/i, "")
      .replace(/^USK\s+/i, "")
      .replace(/^CERO\s+/i, "")
      .replace(/^GRAC\s+/i, "")
      .replace(/^CLASS[_ -]?IND\s+/i, "")
      .replace(/^ACB\s+/i, "")
      .trim();

    const aliasMap = {
      "EVERYONE": "E",
      "EVERYONE 10+": "E10+",
      "EARLY CHILDHOOD": "EC",
      "TEEN": "T",
      "MATURE 17+": "M",
      "MATURE": "M",
      "ADULTS ONLY 18+": "AO",
      "ADULTS ONLY": "AO",
      "RATING PENDING": "RP",
      "RATING PENDING LIKELY MATURE 17+": "RP Likely Mature 17+",
      "RP LIKELY MATURE 17+": "RP Likely Mature 17+",
      "PARENTAL GUIDANCE RECOMMENDED": "PG",
      "PARENTAL GUIDANCE": "PG",
      "PEGI !": "PG"
    };

    if (aliasMap[value]) {
      value = aliasMap[value];
    }

    if (systemId === 4 && value.startsWith("USK ")) {
      value = value.replace(/^USK\s+/i, "").trim();
    }

    return value || null;
  }

  function extractRatingValueFromSynopsis(synopsis, systemId){
    const text = String(synopsis || "");
    if (!text.trim()) return null;

    const upper = text.toUpperCase();

    if (systemId === 2) {
      let m = upper.match(/\bPEGI\s*(3|7|12|16|18)\b/);
      if (m) return m[1];

      m = upper.match(/\bAGED?\s*(3|7|12|16|18)\b/);
      if (m) return m[1];

      m = upper.match(/\b(3|7|12|16|18)\s*YEARS?\s+AND\s+OVER\b/);
      if (m) return m[1];

      if (upper.includes("PARENTAL GUIDANCE")) return "PG";
      if (upper.includes("PEGI !")) return "PG";
    }

    if (systemId === 4) {
      let m = upper.match(/\bUSK\s*(0|6|12|16|18)\b/);
      if (m) return m[1];

      m = upper.match(/\bAB\s*(0|6|12|16|18)\s*JAHREN\b/);
      if (m) return m[1];

      m = upper.match(/\bFREIGEGEBEN\s+AB\s*(0|6|12|16|18)\b/);
      if (m) return m[1];
    }

    if (systemId === 1) {
      if (upper.includes("EARLY CHILDHOOD")) return "EC";
      if (upper.includes("EVERYONE 10+")) return "E10+";
      if (upper.includes("EVERYONE")) return "E";
      if (upper.includes("TEEN")) return "T";
      if (upper.includes("MATURE")) return "M";
      if (upper.includes("ADULTS ONLY")) return "AO";
      if (upper.includes("RATING PENDING LIKELY MATURE")) return "RP Likely Mature 17+";
      if (upper.includes("RATING PENDING")) return "RP";
    }

    if (systemId === 3) {
      const m = upper.match(/\bCERO\s*([ABCDZ])\b/);
      if (m) return m[1];
    }

    if (systemId === 5) {
      let m = upper.match(/\bGRAC\s*(ALL|12|15|18)\b/);
      if (m) return m[1];

      m = upper.match(/\b(ALL|12|15|18)\b/);
      if (m) return m[1];
    }

    if (systemId === 6) {
      if (/\bLIVRE\b/i.test(text)) return "L";

      let m = upper.match(/\b(10|12|14|16|18)\b/);
      if (m) return m[1];
    }

    if (systemId === 7) {
      if (upper.includes("MA15+")) return "MA15+";
      if (upper.includes("R18+")) return "R18+";
      if (upper.includes("PG")) return "PG";
      if (upper.includes("RC")) return "RC";
      if (upper.includes("G")) return "G";
      if (upper.includes("M")) return "M";
    }

    return null;
  }

  function getAgeRatingDisplayValue(item){
    const systemId = getAgeRatingSystemId(item);

    const directLabel =
      item?.rating_category_ref?.rating ||
      item?.rating_category?.rating ||
      item?.rating_category_label ||
      item?.rating_label ||
      item?.rating_category_name ||
      null;

    if (directLabel) {
      return normalizeDisplayValue(directLabel, systemId);
    }

    const fromSynopsis = extractRatingValueFromSynopsis(item?.synopsis, systemId);
    if (fromSynopsis) {
      return normalizeDisplayValue(fromSynopsis, systemId);
    }

    const fromLegacy = legacyRatingValueLabel(getAgeRatingValueId(item));
    if (fromLegacy) {
      return normalizeDisplayValue(fromLegacy, systemId);
    }

    return null;
  }

  function normalizeBadgeValue(value){
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[—–-]/g, "")
      .replace(/\./g, "");
  }

  function localAgeRatingBadgeUrl(item){
    const systemId = getAgeRatingSystemId(item);
    const slug = getAgeRatingSystemSlug(systemId);
    const displayValue = getAgeRatingDisplayValue(item);
    const value = normalizeBadgeValue(displayValue);

    if (!slug || !value) return "";

    const map = {
      "pegi:3": "../assets/age-ratings/pegi-3.png",
      "pegi:7": "../assets/age-ratings/pegi-7.png",
      "pegi:12": "../assets/age-ratings/pegi-12.png",
      "pegi:16": "../assets/age-ratings/pegi-16.png",
      "pegi:18": "../assets/age-ratings/pegi-18.png",
      "pegi:pg": "../assets/age-ratings/pegi-pg.png",

      "usk:0": "../assets/age-ratings/usk-0.png",
      "usk:6": "../assets/age-ratings/usk-6.png",
      "usk:12": "../assets/age-ratings/usk-12.png",
      "usk:16": "../assets/age-ratings/usk-16.png",
      "usk:18": "../assets/age-ratings/usk-18.png",

      "esrb:ec": "../assets/age-ratings/esrb-ec.png",
      "esrb:e": "../assets/age-ratings/esrb-e.png",
      "esrb:e10+": "../assets/age-ratings/esrb-e10.png",
      "esrb:t": "../assets/age-ratings/esrb-t.png",
      "esrb:m": "../assets/age-ratings/esrb-m.png",
      "esrb:ao": "../assets/age-ratings/esrb-ao.png",
      "esrb:rp": "../assets/age-ratings/esrb-rp.png",
      "esrb:rplikelymature17+": "../assets/age-ratings/esrb-rp-likely-mature.png",

      "cero:a": "../assets/age-ratings/cero-a.png",
      "cero:b": "../assets/age-ratings/cero-b.png",
      "cero:c": "../assets/age-ratings/cero-c.png",
      "cero:d": "../assets/age-ratings/cero-d.png",
      "cero:z": "../assets/age-ratings/cero-z.png",

      "grac:all": "../assets/age-ratings/grac-all.png",
      "grac:12": "../assets/age-ratings/grac-12.png",
      "grac:15": "../assets/age-ratings/grac-15.png",
      "grac:18": "../assets/age-ratings/grac-18.png",

      "classind:l": "../assets/age-ratings/classind-l.png",
      "classind:10": "../assets/age-ratings/classind-10.png",
      "classind:12": "../assets/age-ratings/classind-12.png",
      "classind:14": "../assets/age-ratings/classind-14.png",
      "classind:16": "../assets/age-ratings/classind-16.png",
      "classind:18": "../assets/age-ratings/classind-18.png",

      "acb:g": "../assets/age-ratings/acb-g.png",
      "acb:pg": "../assets/age-ratings/acb-pg.png",
      "acb:m": "../assets/age-ratings/acb-m.png",
      "acb:ma15+": "../assets/age-ratings/acb-ma15.png",
      "acb:r18+": "../assets/age-ratings/acb-r18.png",
      "acb:rc": "../assets/age-ratings/acb-rc.png"
    };

    return map[`${slug}:${value}`] || "";
  }

  function collectAgeRatings(ageRatings){
    const list = Array.isArray(ageRatings) ? ageRatings : [];
    if (!list.length) return [];

    const priority = [4, 2, 1, 3, 5, 6, 7];
    const seenIds = new Set();

    return [...list]
      .filter(item => {
        const id = Number(item?.id);
        if (!Number.isFinite(id)) return false;
        if (seenIds.has(id)) return false;
        seenIds.add(id);
        return true;
      })
      .sort((a, b) => {
        const aOrg = getAgeRatingSystemId(a);
        const bOrg = getAgeRatingSystemId(b);

        const aIdx = priority.indexOf(aOrg);
        const bIdx = priority.indexOf(bOrg);

        const pa = aIdx === -1 ? 999 : aIdx;
        const pb = bIdx === -1 ? 999 : bIdx;

        if (pa !== pb) return pa - pb;

        const aHasBadge = !!(normalizeRatingCoverUrl(a?.rating_cover_url) || localAgeRatingBadgeUrl(a));
        const bHasBadge = !!(normalizeRatingCoverUrl(b?.rating_cover_url) || localAgeRatingBadgeUrl(b));

        if (aHasBadge !== bHasBadge) {
          return Number(bHasBadge) - Number(aHasBadge);
        }

        const aLabel = ratingSystemLabel(aOrg);
        const bLabel = ratingSystemLabel(bOrg);
        return aLabel.localeCompare(bLabel);
      });
  }

  function gameCard(gm){
    const gid = gm?.id;
    const name = gm?.name || "Unknown";
    const coverId = gm?.cover?.image_id;
    return `
      <button class="mini-card" type="button" data-gid="${esc(gid)}">
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

    const websites = Array.isArray(game?.websites) ? game.websites : [];
    const ratings = collectAgeRatings(game?.age_ratings);

    const websiteHtml = websites.length
      ? websites.slice(0, 10).map(w => {
          const url = w?.url;
          if (!url) return "";
          const host = (() => {
            try {
              return new URL(url).hostname.replace("www.","");
            } catch {
              return url;
            }
          })();
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

        <div class="sub-card age-rating-card">
          <h4>Age Ratings</h4>
          <div class="sub-body age-rating-grid">
            ${
              ratings.length
                ? ratings.map(r => {
                    const systemId = getAgeRatingSystemId(r);
                    const label = ratingSystemLabel(systemId);
                    const displayValue = getAgeRatingDisplayValue(r);
                    const prettyValue = displayValue ? `${label} ${displayValue}` : label;

                    const igdbBadgeUrl = normalizeRatingCoverUrl(r?.rating_cover_url);
                    const localBadgeUrl = localAgeRatingBadgeUrl(r);
                    const badgeUrl = igdbBadgeUrl || localBadgeUrl;

                    return `
                      <div class="age-rating-item">
                        <div class="age-rating-label">${esc(label)}</div>
                        <div class="age-rating-media">
                          ${
                            badgeUrl
                              ? `<img class="age-rating-badge" src="${esc(badgeUrl)}" alt="${esc(prettyValue)}" loading="lazy">`
                              : `<span class="chip">${esc(prettyValue)}</span>`
                          }
                        </div>
                      </div>
                    `;
                  }).join("")
                : `<span class="muted">No age rating available.</span>`
            }
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
        <h4>Forums</h4>
        <p class="muted">Later Forums will be available here.</p>
      </div>
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
      related: qs("panel-related"),
    };

    function setActive(key){
      tabs.forEach(t => {
        const on = t.dataset.tab === key;
        t.classList.toggle("active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
      });

      Object.entries(panels).forEach(([k, p]) => {
        if (p) p.classList.toggle("active", k === key);
      });
    }

    tabs.forEach(t => {
      t.addEventListener("click", () => {
        setActive(t.dataset.tab);
      });
    });

    setActive("about");
  }

  renderAboutTab(g);
  renderCommunityTab();
  renderRelatedTab(g);
  initTabs();
}

document.addEventListener("DOMContentLoaded", () => {
  loadGame().catch(err => {
    console.error(err);
    const title = document.getElementById("gameTitle");
    if (title) title.textContent = "Could not load game.";
  });
});