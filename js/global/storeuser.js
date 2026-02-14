function getHomeUrl() {
  const baseMeta = document.querySelector('meta[name="app-base"]');
  const base = (baseMeta?.content || "/").replace(/\/?$/, "/");
  return new URL("index.html", window.location.origin + base).toString();
}

function setDropdownOpen(dropdown, open) {
  if (!dropdown) return;
  dropdown.classList.toggle("open", open);
  dropdown.setAttribute("aria-hidden", open ? "false" : "true");
}

function updateAuthState() {
  const token = localStorage.getItem("token");
  document.documentElement.dataset.auth = token ? "in" : "out";
  return !!token;
}

document.addEventListener("DOMContentLoaded", () => {
  updateAuthState();

  const userIcon = document.getElementById("userIcon");
  const userMenu = document.getElementById("userMenu");
  const dropdown = document.getElementById("userDropdown");
  const logoutBtn = document.getElementById("logoutBtn");

  if (!userIcon || !userMenu || !dropdown) return;

  userIcon.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.contains("open");
    setDropdownOpen(dropdown, !isOpen);
  });

  document.addEventListener("click", (e) => {
    if (!userMenu.contains(e.target)) setDropdownOpen(dropdown, false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setDropdownOpen(dropdown, false);
  });

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("token");
      setDropdownOpen(dropdown, false);
      updateAuthState();
      window.location.href = getHomeUrl();
    });
  }
});