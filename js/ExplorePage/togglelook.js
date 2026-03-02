const viewToggle = document.getElementById("viewToggle");
const VIEW_KEY = "exploreView";

function setView(view){
  gameGrid.dataset.view = view;
  localStorage.setItem(VIEW_KEY, view);

  if (viewToggle){
    viewToggle.querySelectorAll(".view-btn").forEach(btn=>{
      btn.classList.toggle("active", btn.dataset.view === view);
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem(VIEW_KEY) || "grid";
  setView(saved);

  if (viewToggle){
    viewToggle.addEventListener("click", (e)=>{
      const btn = e.target.closest(".view-btn");
      if (!btn) return;
      setView(btn.dataset.view);
    });
  }
});