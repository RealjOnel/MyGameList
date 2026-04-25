import { showToast } from "./toast.js";
import { fetchWithAuth, clearAccessToken } from "./authClient.js";

let isInitialized = false;

const DEFAULT_AVATAR_URL = "/assets/User/Default_User_Icon.png";
const DEFAULT_BANNER_URL = "/assets/User/banner.png";

const DEFAULT_SETTINGS = Object.freeze({
  profile: {
    bio: "",
    links: {
      discord: "",
      youtube: "",
      twitch: "",
      steam: "",
      website: ""
    },
    optionalFields: {
      location: "",
      favoriteGenre: "",
      favoritePlatform: ""
    }
  },
  social: {
    showFriendsList: true,
    showReviews: true,
    showForumActivity: true,
    showFavoriteGames: true,
    showActivityHistory: true,
    allowProfileComments: true,
    showProfileComments: true
  },
  privacy: {
    publicProfile: true,
    showProfileInSearch: true,
    allowDirectFriendRequests: true,
    cookies: {
      preferences: true,
      analytics: false
    }
  },
  customization: {
    defaultExploreView: "grid",
    compactInterface: false,
    reducedMotion: false,
    liveSearchSuggestions: true
  }
});

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function deepMerge(target, source) {
  const out = { ...target };

  for (const [key, value] of Object.entries(source || {})) {
    if (isPlainObject(value) && isPlainObject(out[key])) {
      out[key] = deepMerge(out[key], value);
    } else {
      out[key] = value;
    }
  }

  return out;
}

function normalizeSettings(raw) {
  return deepMerge(cloneDefaults(), raw || {});
}

function redirectToLogin() {
  window.location.href = "../LoginPageAndLogic/login.html";
}

function safeParseJson(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

async function api(path, { method = "GET", body } = {}) {
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
  const data = safeParseJson(text);

  if (res.status === 401) {
    clearAccessToken();
    throw new Error("SESSION_EXPIRED");
  }

  if (!res.ok) {
    throw new Error(data?.message || `Request failed (${res.status})`);
  }

  return data;
}

async function uploadProfileMedia(type, file) {
  const formData = new FormData();
  formData.append("image", file);

  const res = await fetchWithAuth(`/api/users/profile-media/${encodeURIComponent(type)}`, {
    method: "POST",
    body: formData
  });

  const text = await res.text();
  const data = safeParseJson(text);

  if (res.status === 401) {
    clearAccessToken();
    throw new Error("SESSION_EXPIRED");
  }

  if (!res.ok) {
    throw new Error(data?.message || `Upload failed (${res.status})`);
  }

  return data;
}

function getSettingFields() {
  return [...document.querySelectorAll("[data-setting]")];
}

function setByPath(obj, path, value) {
  const parts = path.split(".");
  let ref = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!isPlainObject(ref[key])) ref[key] = {};
    ref = ref[key];
  }

  ref[parts[parts.length - 1]] = value;
}

function getByPath(obj, path) {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

function readFieldValue(field) {
  if (field instanceof HTMLInputElement && field.type === "checkbox") {
    return field.checked;
  }
  return field.value;
}

function writeFieldValue(field, value) {
  if (field instanceof HTMLInputElement && field.type === "checkbox") {
    field.checked = Boolean(value);
    return;
  }

  field.value = value ?? "";
}

function collectSettingsFromForm() {
  const settings = cloneDefaults();

  for (const field of getSettingFields()) {
    const path = field.dataset.setting;
    if (!path) continue;
    setByPath(settings, path, readFieldValue(field));
  }

  return settings;
}

function setImagePreview(imgEl, url, fallbackUrl) {
  if (!imgEl) return;
  imgEl.src = url || fallbackUrl;
}

function populateProfileMeta(data = {}) {
  const avatarPreview = document.getElementById("settingsAvatarPreview");
  const bannerPreview = document.getElementById("settingsBannerPreview");
  const usernameInput = document.getElementById("settingsUsernameInput");

  setImagePreview(avatarPreview, data?.avatarUrl, DEFAULT_AVATAR_URL);
  setImagePreview(bannerPreview, data?.bannerUrl, DEFAULT_BANNER_URL);

  if (usernameInput) {
    usernameInput.value = data?.username || "";
  }
}

function populateSettingsForm(settings) {
  const merged = normalizeSettings(settings);

  for (const field of getSettingFields()) {
    const path = field.dataset.setting;
    if (!path) continue;
    writeFieldValue(field, getByPath(merged, path));
  }

  updateBioCounter();
}

function updateBioCounter() {
  const bioField = document.querySelector('[data-setting="profile.bio"]');
  const bioCounter = document.getElementById("settingsBioCounter");

  if (!bioField || !bioCounter) return;

  const current = bioField.value.length;
  const max = Number(bioField.getAttribute("maxlength") || 100);
  bioCounter.textContent = `${current} / ${max} characters`;
}

async function loadSettingsIntoForm() {
  const data = await api("/api/users/settings");
  populateSettingsForm(data?.settings);
  populateProfileMeta(data);
  return data;
}

async function saveSettingsFromForm() {
  const saveSettingsBtn = document.getElementById("settingsSaveBtn");
  const settings = collectSettingsFromForm();

  if (saveSettingsBtn) {
    saveSettingsBtn.disabled = true;
    saveSettingsBtn.textContent = "Saving...";
  }

  try {
    const data = await api("/api/users/settings", {
      method: "PATCH",
      body: settings
    });

    populateSettingsForm(data?.settings);
    populateProfileMeta(data);

    window.dispatchEvent(
      new CustomEvent("mgl:settings-saved", {
        detail: { settings: data?.settings }
      })
    );

    showToast({
      title: "Settings saved",
      message: "Your settings have been updated successfully.",
      type: "success"
    });
  } finally {
    if (saveSettingsBtn) {
      saveSettingsBtn.disabled = false;
      saveSettingsBtn.textContent = "Save Changes";
    }
  }
}

function getOverlay() {
  return document.getElementById("settingsOverlay");
}

async function openSettings() {
  const settingsOverlay = getOverlay();
  if (!settingsOverlay) return;

  settingsOverlay.hidden = false;
  settingsOverlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  try {
    await loadSettingsIntoForm();
  } catch (err) {
    console.error(err);

    if (err.message === "SESSION_EXPIRED") {
      redirectToLogin();
      return;
    }

    showToast({
      title: "Settings failed to load",
      message: err.message || "Could not load settings.",
      type: "error"
    });
  }
}

function closeSettings() {
  const settingsOverlay = getOverlay();
  if (!settingsOverlay) return;

  settingsOverlay.hidden = true;
  settingsOverlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function closeUserDropdownIfOpen() {
  const userDropdown = document.getElementById("userDropdown");
  if (userDropdown) {
    userDropdown.classList.remove("open");
    userDropdown.setAttribute("aria-hidden", "true");
  }
}

function setupTabs() {
  const settingsTabs = document.querySelectorAll(".settings-tab");
  const settingsPanels = document.querySelectorAll(".settings-panel");

  settingsTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.settingsTab;

      settingsTabs.forEach((btn) => {
        btn.classList.toggle("active", btn === tab);
      });

      settingsPanels.forEach((panel) => {
        panel.classList.toggle("active", panel.dataset.settingsPanel === target);
      });
    });
  });
}

function getUploadEls(type) {
  if (type === "avatar") {
    return {
      input: document.getElementById("settingsAvatarInput"),
      label: document.getElementById("settingsAvatarUploadLabel"),
      preview: document.getElementById("settingsAvatarPreview"),
      idleText: "Change Picture",
      fallback: DEFAULT_AVATAR_URL
    };
  }

  return {
    input: document.getElementById("settingsBannerInput"),
    label: document.getElementById("settingsBannerUploadLabel"),
    preview: document.getElementById("settingsBannerPreview"),
    idleText: "Change Banner",
    fallback: DEFAULT_BANNER_URL
  };
}

function setUploadBusy(type, busy) {
  const els = getUploadEls(type);
  if (!els.input || !els.label) return;

  els.input.disabled = busy;
  els.label.textContent = busy ? "Uploading..." : els.idleText;
}

function updateGlobalAvatar(url) {
  const userIcon = document.getElementById("userIcon");
  if (userIcon) {
    userIcon.src = url || DEFAULT_AVATAR_URL;
  }

  const profileAvatar = document.getElementById("profile_log");
  if (profileAvatar) {
    profileAvatar.src = url || DEFAULT_AVATAR_URL;
  }
}

function updateGlobalBanner(url) {
  const profileBanner = document.querySelector(".profile_banner_image");
  if (profileBanner) {
    profileBanner.src = url || DEFAULT_BANNER_URL;
  }
}

async function handleProfileMediaUpload(type, file) {
  if (!file) return;

  setUploadBusy(type, true);

  try {
    const data = await uploadProfileMedia(type, file);
    populateProfileMeta(data);

    if (type === "avatar") {
      updateGlobalAvatar(data?.avatarUrl);
    } else {
      updateGlobalBanner(data?.bannerUrl);
    }

    window.dispatchEvent(
      new CustomEvent("mgl:profile-media-updated", {
        detail: {
          avatarUrl: data?.avatarUrl ?? undefined,
          bannerUrl: data?.bannerUrl ?? undefined
        }
      })
    );

    showToast({
      title: type === "avatar" ? "Avatar updated" : "Banner updated",
      message: type === "avatar"
        ? "Your profile picture has been updated."
        : "Your profile banner has been updated.",
      type: "success"
    });
  } finally {
    const els = getUploadEls(type);
    if (els.input) {
      els.input.value = "";
    }
    setUploadBusy(type, false);
  }
}

export function initSettingsModal() {
  if (isInitialized) return;

  const settingsOverlay = getOverlay();
  if (!settingsOverlay) return;

  const closeSettingsBtn = document.getElementById("closeSettingsBtn");
  const cancelSettingsBtn = document.getElementById("settingsCancelBtn");
  const saveSettingsBtn = document.getElementById("settingsSaveBtn");
  const bioField = document.querySelector('[data-setting="profile.bio"]');

  document.addEventListener("click", async (e) => {
    const openTrigger = e.target.closest("[data-open-settings]");
    if (openTrigger) {
      e.preventDefault();
      closeUserDropdownIfOpen();
      await openSettings();
      return;
    }

    const closeTrigger = e.target.closest("[data-close-settings]");
    if (closeTrigger) {
      closeSettings();
    }
  });

  document.addEventListener("change", async (e) => {
    const input = e.target.closest('input[type="file"][data-profile-media]');
    if (!input) return;

    const type = input.dataset.profileMedia;
    const file = input.files?.[0];

    if (!type || !file) return;

    try {
      await handleProfileMediaUpload(type, file);
    } catch (err) {
      console.error(err);

      if (err.message === "SESSION_EXPIRED") {
        redirectToLogin();
        return;
      }

      showToast({
        title: "Upload failed",
        message: err.message || "Could not upload the selected image.",
        type: "error"
      });
    }
  });

  if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener("click", closeSettings);
  }

  if (cancelSettingsBtn) {
    cancelSettingsBtn.addEventListener("click", closeSettings);
  }

  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener("click", async () => {
      try {
        await saveSettingsFromForm();
      } catch (err) {
        console.error(err);

        if (err.message === "SESSION_EXPIRED") {
          redirectToLogin();
          return;
        }

        showToast({
          title: "Save failed",
          message: err.message || "Could not save settings.",
          type: "error"
        });
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && settingsOverlay && !settingsOverlay.hidden) {
      closeSettings();
    }
  });

  if (bioField) {
    bioField.addEventListener("input", updateBioCounter);
  }

  setupTabs();
  isInitialized = true;
}