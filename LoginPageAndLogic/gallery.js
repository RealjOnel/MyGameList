import { API_BASE_URL } from "../../backend/config.js";

async function loadDynamicGallery() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/igdb/trending?limit=12&type=1`, {
    cache: "no-store",
    });
    const games = await response.json();

    const track = document.querySelector(".gallery-track");
    if (!track) return;

    track.innerHTML = "";

    games.forEach((game) => {
      const imgId = game?.cover?.image_id;
      if (!imgId) return;

      const imgUrl = `https://images.igdb.com/igdb/image/upload/t_1080p/${imgId}.jpg`;

      const div = document.createElement("div");
      div.className = "gallery-item";
      div.style.backgroundImage = `url("${imgUrl}")`;

      track.appendChild(div);
    });

    // duplicate for infinite track illusion
    track.innerHTML += track.innerHTML;
  } catch (error) {
    console.error("Couldnt load gallery:", error);
  }
}

document.addEventListener("DOMContentLoaded", loadDynamicGallery);