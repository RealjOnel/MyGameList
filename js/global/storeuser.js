import { logout, syncAuthState, fetchWithAuth, clearAccessToken } from "./authClient.js";

const DEFAULT_NAV_AVATAR = "/assets/User/Default_User_Icon.png";

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

function safeParseJson(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

async function loadNavbarUserAvatar() {
  const userIcon = document.getElementById("userIcon");
  if (!userIcon) return;

  userIcon.src = DEFAULT_NAV_AVATAR;

  const hasToken = syncAuthState();
  if (!hasToken) return;

  try {
    const res = await fetchWithAuth("/api/users/me", {
      method: "GET"
    });

    if (res.status === 401) {
      clearAccessToken();
      userIcon.src = DEFAULT_NAV_AVATAR;
      return;
    }

    const text = await res.text();
    const data = safeParseJson(text);

    if (res.ok && data?.avatarUrl) {
      userIcon.src = data.avatarUrl;
    }
  } catch (err) {
    console.error("Failed to load navbar user avatar:", err);
    userIcon.src = DEFAULT_NAV_AVATAR;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  syncAuthState();
  loadNavbarUserAvatar().catch(console.error);

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
    logoutBtn.addEventListener("click", async () => {
      logoutBtn.disabled = true;
      setDropdownOpen(dropdown, false);

      try {
        await logout();
      } finally {
        logoutBtn.disabled = false;
        window.location.href = getHomeUrl();
      }
    });
  }
});

window.addEventListener("mgl:profile-media-updated", (e) => {
  const userIcon = document.getElementById("userIcon");
  if (!userIcon) return;

  const nextAvatarUrl = e.detail?.avatarUrl;
  if (nextAvatarUrl !== undefined) {
    userIcon.src = nextAvatarUrl || DEFAULT_NAV_AVATAR;
  }
});