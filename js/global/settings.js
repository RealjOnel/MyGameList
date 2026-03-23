import { showToast } from "./toast.js";
import { fetchWithAuth } from "./authClient.js";

let isInitialized = false;

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
    allowProfileComments: true
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

async function api(path, { method = "GET", body } = {}) {
  return fetchWithAuth(path, { method, body });
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

function normalizeSettings(raw) {
  return deepMerge(cloneDefaults(), raw || {});
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
  return data?.settings;
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