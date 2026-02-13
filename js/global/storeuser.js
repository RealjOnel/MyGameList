function getHomeUrl() {
  const baseMeta = document.querySelector('meta[name="app-base"]');
  const base = (baseMeta?.content || "/").replace(/\/?$/, "/"); // trailing slash
  return new URL("index.html", window.location.origin + base).toString();
}

function setDropdownOpen(dropdown, open) {
  if (!dropdown) return;
  dropdown.classList.toggle("open", open);
  dropdown.setAttribute("aria-hidden", open ? "false" : "true");
}

function updateNavbarAuth() {
  const token = localStorage.getItem("token");

  const loginBtn = document.getElementById("loginBtn");
  const userMenu = document.getElementById("userMenu");
  const dropdown = document.getElementById("userDropdown");

  if (!loginBtn || !userMenu) return;

  if (token) {
    loginBtn.style.display = "none";
    userMenu.style.display = "inline-block";
  } else {
    loginBtn.style.display = "inline-block";
    userMenu.style.display = "none";
    setDropdownOpen(dropdown, false);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  updateNavbarAuth();

  const userIcon = document.getElementById("userIcon");
  const userMenu = document.getElementById("userMenu");
  const dropdown = document.getElementById("userDropdown");
  const logoutBtn = document.getElementById("logoutBtn");

  // If Navbar doesnt exist
  if (!userIcon || !userMenu || !dropdown) return;

  // Toggle click on Icon
  userIcon.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.contains("open");
    setDropdownOpen(dropdown, !isOpen);
  });

  // Clicking beside it closes
  document.addEventListener("click", (e) => {
    if (!userMenu.contains(e.target)) {
      setDropdownOpen(dropdown, false);
    }
  });

  // ESC 
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setDropdownOpen(dropdown, false);
  });

  // Logout
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("token");
      setDropdownOpen(dropdown, false);
      updateNavbarAuth();
      window.location.href = getHomeUrl();
    });
  }
});