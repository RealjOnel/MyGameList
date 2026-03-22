const gameGrid = document.getElementById("gameGrid");
const viewToggle = document.getElementById("viewToggle");

function getSafeView(view) {
  return ["grid", "compact", "table"].includes(view) ? view : "grid";
}

function getDefaultViewFromSettings() {
  return getSafeView(document.documentElement.dataset.defaultExploreView || "grid");
}

function setView(view) {
  if (!gameGrid) return;

  const safeView = getSafeView(view);
  gameGrid.dataset.view = safeView;
  window.currentExploreView = safeView;

  if (viewToggle) {
    viewToggle.querySelectorAll(".view-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === safeView);
    });
  }
}

window.setExploreView = setView;

document.addEventListener("DOMContentLoaded", () => {
  setView(getDefaultViewFromSettings());

  if (viewToggle) {
    viewToggle.addEventListener("click", (e) => {
      const btn = e.target.closest(".view-btn");
      if (!btn) return;

      setView(btn.dataset.view);
    });
  }
});

window.addEventListener("mgl:customization-applied", (e) => {
  const nextView = e.detail?.customization?.defaultExploreView || getDefaultViewFromSettings();
  setView(nextView);
});

window.addEventListener("mgl:settings-saved", (e) => {
  const nextView = e.detail?.settings?.customization?.defaultExploreView || getDefaultViewFromSettings();
  setView(nextView);
});