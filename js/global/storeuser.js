import { logout, syncAuthState, fetchWithAuth, clearAccessToken } from "./authClient.js";
import { bootstrapCookiePreferences, preferenceStorageGetItem, preferenceStorageSetItem, preferenceStorageRemoveItem } from "./privacyPreferences.js";

const DEFAULT_NAV_AVATAR = "/assets/User/Default_User_Icon.png";
const NAV_AVATAR_CACHE_KEY = "mgl_nav_avatar_url";

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

  const hasToken = syncAuthState();

  if (!hasToken) {
    preferenceStorageRemoveItem(NAV_AVATAR_CACHE_KEY);
    userIcon.src = DEFAULT_NAV_AVATAR;
    userIcon.classList.remove("user-icon--pending");
    userIcon.classList.add("user-icon--ready");
    return;
  }

  const cachedAvatar = preferenceStorageGetItem(NAV_AVATAR_CACHE_KEY);

  if (cachedAvatar) {
    userIcon.src = cachedAvatar;
    userIcon.classList.remove("user-icon--pending");
    userIcon.classList.add("user-icon--ready");
  }

  try {
    const res = await fetchWithAuth("/api/users/me", {
      method: "GET"
    });

    if (res.status === 401) {
      clearAccessToken();
      preferenceStorageRemoveItem(NAV_AVATAR_CACHE_KEY);
      userIcon.src = DEFAULT_NAV_AVATAR;
      userIcon.classList.remove("user-icon--pending");
      userIcon.classList.add("user-icon--ready");
      return;
    }

    const text = await res.text();
    const data = safeParseJson(text);

    if (!res.ok) {
      throw new Error(data?.message || "Failed to load navbar avatar");
    }

    const nextAvatar = data?.avatarUrl || DEFAULT_NAV_AVATAR;

    userIcon.src = nextAvatar;
    userIcon.classList.remove("user-icon--pending");
    userIcon.classList.add("user-icon--ready");

    if (data?.avatarUrl) {
      preferenceStorageSetItem(NAV_AVATAR_CACHE_KEY, data.avatarUrl);
    } else {
      preferenceStorageRemoveItem(NAV_AVATAR_CACHE_KEY);
    }
  } catch (err) {
    console.error("Failed to load navbar user avatar:", err);

    if (!cachedAvatar) {
      userIcon.src = DEFAULT_NAV_AVATAR;
      userIcon.classList.remove("user-icon--pending");
      userIcon.classList.add("user-icon--ready");
    }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  syncAuthState();
  await bootstrapCookiePreferences();
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
        preferenceStorageRemoveItem(NAV_AVATAR_CACHE_KEY);
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
    userIcon.classList.remove("user-icon--pending");
    userIcon.classList.add("user-icon--ready");

    if (nextAvatarUrl) {
      preferenceStorageSetItem(NAV_AVATAR_CACHE_KEY, nextAvatarUrl);
    } else {
      preferenceStorageRemoveItem(NAV_AVATAR_CACHE_KEY);
    }
  }
});