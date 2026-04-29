import { showToast } from "./toast.js";
import { fetchWithAuth, clearAccessToken } from "./authClient.js";

let isInitialized = false;

const DEFAULT_AVATAR_URL = "/assets/User/Default_User_Icon.png";
const DEFAULT_BANNER_URL = "/assets/User/banner.png";
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB

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

const pendingProfileMedia = {
  avatar: null,
  banner: null
};

const profileMetaState = {
  avatarUrl: DEFAULT_AVATAR_URL,
  bannerUrl: DEFAULT_BANNER_URL,
  username: ""
};

const usernameChangeState = {
  canChangeNow: true,
  minDaysBetweenChanges: 14,
  lastChangedAt: null,
  nextChangeAt: null,
  waitDaysRemaining: 0
};

const cropState = {
  type: null,
  objectUrl: null,
  image: null,
  naturalWidth: 0,
  naturalHeight: 0,
  frameWidth: 0,
  frameHeight: 0,
  minScale: 1,
  maxScale: 1,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  dragging: false,
  pointerId: null,
  dragStartX: 0,
  dragStartY: 0,
  dragOriginX: 0,
  dragOriginY: 0
};

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
    const err = new Error(data?.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
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

  imgEl.onerror = () => {
    imgEl.src = fallbackUrl;
  };

  imgEl.src = url || fallbackUrl;
}

// Change Username helper functions

function syncUsernameChangeMeta(data = {}) {
  const info = data?.usernameChange;
  if (!info) return;

  usernameChangeState.canChangeNow = info.canChangeNow !== false;
  usernameChangeState.minDaysBetweenChanges = Number(info.minDaysBetweenChanges || 14);
  usernameChangeState.lastChangedAt = info.lastChangedAt || null;
  usernameChangeState.nextChangeAt = info.nextChangeAt || null;
  usernameChangeState.waitDaysRemaining = Number(info.waitDaysRemaining || 0);
}

function formatUsernameChangeNote() {
  const noteEl = document.getElementById("settingsUsernameNote");
  const inputEl = document.getElementById("settingsUsernameInput");

  if (!noteEl || !inputEl) return;

  if (usernameChangeState.canChangeNow) {
    noteEl.textContent = `You can change your username now. Next change will be available in ${usernameChangeState.minDaysBetweenChanges} days.`;
    inputEl.readOnly = false;
    inputEl.disabled = false;
    return;
  }

  const nextDate = usernameChangeState.nextChangeAt
    ? new Date(usernameChangeState.nextChangeAt).toLocaleDateString("en-GB")
    : null;

  noteEl.textContent = nextDate
    ? `Next username change available on ${nextDate} (${usernameChangeState.waitDaysRemaining} day(s) left).`
    : `Next username change available in ${usernameChangeState.waitDaysRemaining} day(s).`;

  inputEl.readOnly = true;
  inputEl.disabled = false;
}

function normalizeUsernameInputValue(value) {
  return String(value || "").trim();
}

function syncOwnProfileUrl(oldUsername, newUsername) {
  if (!newUsername) return;

  const url = new URL(window.location.href);
  const currentUsernameParam = url.searchParams.get("username");

  if (url.pathname.includes("/profile/")) {
    if (!currentUsernameParam || currentUsernameParam.trim().toLowerCase() === String(oldUsername || "").trim().toLowerCase()) {
      url.searchParams.set("username", newUsername);
      window.history.replaceState({}, "", url.toString());
    }
  }

  document.querySelectorAll('#userDropdown a[href*="profile.html"]').forEach((link) => {
    link.href = `/profile/profile.html?username=${encodeURIComponent(newUsername)}`;
  });
}

async function trySaveUsernameChange() {
  const usernameInput = document.getElementById("settingsUsernameInput");
  if (!usernameInput) {
    return { changed: false, error: null };
  }

  const nextUsername = normalizeUsernameInputValue(usernameInput.value);
  const currentUsername = normalizeUsernameInputValue(profileMetaState.username);

  if (!nextUsername || nextUsername === currentUsername) {
    return { changed: false, error: null };
  }

  try {
    const data = await api("/api/users/username", {
      method: "PATCH",
      body: { username: nextUsername }
    });

    const previousUsername = profileMetaState.username;

    syncProfileMeta(data);
    syncUsernameChangeMeta(data);
    populateProfileMeta();
    syncOwnProfileUrl(previousUsername, profileMetaState.username);

    window.dispatchEvent(
      new CustomEvent("mgl:username-updated", {
        detail: {
          oldUsername: previousUsername,
          username: profileMetaState.username
        }
      })
    );

    return { changed: true, error: null };
  } catch (err) {
    syncUsernameChangeMeta(err?.data || {});
    populateProfileMeta();
    return { changed: false, error: err };
  }
}

function syncProfileMeta(data = {}) {
  if (!data || typeof data !== "object") return;

  if ("avatarUrl" in data) {
    profileMetaState.avatarUrl = data.avatarUrl || DEFAULT_AVATAR_URL;
  }

  if ("bannerUrl" in data) {
    profileMetaState.bannerUrl = data.bannerUrl || DEFAULT_BANNER_URL;
  }

  if ("username" in data) {
    profileMetaState.username = data.username || "";
  }
}

function getUploadEls(type) {
  const isAvatar = type === "avatar";
  const input = document.getElementById(isAvatar ? "settingsAvatarInput" : "settingsBannerInput");

  return {
    input,
    button: input?.closest(".settings-file-btn") || null,
    label: document.getElementById(isAvatar ? "settingsAvatarUploadLabel" : "settingsBannerUploadLabel"),
    preview: document.getElementById(isAvatar ? "settingsAvatarPreview" : "settingsBannerPreview"),
    idleText: isAvatar ? "Change Picture" : "Change Banner",
    pendingText: isAvatar ? "Picture Ready" : "Banner Ready",
    fallback: isAvatar ? DEFAULT_AVATAR_URL : DEFAULT_BANNER_URL
  };
}

function getCurrentSavedMediaUrl(type) {
  return type === "avatar"
    ? (profileMetaState.avatarUrl || DEFAULT_AVATAR_URL)
    : (profileMetaState.bannerUrl || DEFAULT_BANNER_URL);
}

function getDisplayMediaUrl(type) {
  return pendingProfileMedia[type]?.previewUrl || getCurrentSavedMediaUrl(type);
}

function refreshUploadUi(type, { busy = false } = {}) {
  const els = getUploadEls(type);
  if (!els.input || !els.label || !els.preview) return;

  const hasPending = Boolean(pendingProfileMedia[type]);

  els.input.disabled = busy;
  els.label.textContent = busy ? "Uploading..." : (hasPending ? els.pendingText : els.idleText);
  els.button?.classList.toggle("is-pending", hasPending && !busy);

  setImagePreview(els.preview, getDisplayMediaUrl(type), els.fallback);
}

function refreshAllUploadUi() {
  refreshUploadUi("avatar");
  refreshUploadUi("banner");
}

function populateProfileMeta() {
  const usernameInput = document.getElementById("settingsUsernameInput");

  if (usernameInput) {
    usernameInput.value = profileMetaState.username || "";
  }

  refreshAllUploadUi();
  formatUsernameChangeNote();
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
  syncProfileMeta(data);
  syncUsernameChangeMeta(data);
  populateSettingsForm(data?.settings);
  populateProfileMeta();
  return data;
}

function revokePendingPreview(type) {
  const previewUrl = pendingProfileMedia[type]?.previewUrl;
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }
}

function clearPendingMedia(type) {
  revokePendingPreview(type);
  pendingProfileMedia[type] = null;

  const input = getUploadEls(type).input;
  if (input) input.value = "";

  refreshUploadUi(type);
}

function clearAllPendingMedia() {
  clearPendingMedia("avatar");
  clearPendingMedia("banner");
}

function setPendingMedia(type, file, previewUrl) {
  clearPendingMedia(type);

  pendingProfileMedia[type] = {
    file,
    previewUrl
  };

  refreshUploadUi(type);
}

async function saveSettingsFromForm() {
  const saveSettingsBtn = document.getElementById("settingsSaveBtn");
  const settings = collectSettingsFromForm();

  const usernameInput = document.getElementById("settingsUsernameInput");
  const pendingUsernameValue = normalizeUsernameInputValue(usernameInput?.value);

  if (saveSettingsBtn) {
    saveSettingsBtn.disabled = true;
    saveSettingsBtn.textContent = "Saving...";
  }

  try {
    const data = await api("/api/users/settings", {
      method: "PATCH",
      body: settings
    });

    syncProfileMeta(data);
    syncUsernameChangeMeta(data);

    populateSettingsForm(data?.settings);

    if (usernameInput) {
      usernameInput.value = pendingUsernameValue || profileMetaState.username || "";
    }

    formatUsernameChangeNote();
    refreshAllUploadUi();

    let usernameResult = { changed: false, error: null };

    usernameResult = await trySaveUsernameChange();

    if (usernameResult.error) {
      if (usernameResult.error.message === "SESSION_EXPIRED") {
        throw usernameResult.error;
      }
    }

    const mediaEventDetail = {};

    if (pendingProfileMedia.avatar) {
      if (saveSettingsBtn) saveSettingsBtn.textContent = "Uploading avatar...";

      refreshUploadUi("avatar", { busy: true });

      const avatarData = await uploadProfileMedia("avatar", pendingProfileMedia.avatar.file);
      syncProfileMeta(avatarData);
      mediaEventDetail.avatarUrl = profileMetaState.avatarUrl;
      clearPendingMedia("avatar");
    }

    if (pendingProfileMedia.banner) {
      if (saveSettingsBtn) saveSettingsBtn.textContent = "Uploading banner...";

      refreshUploadUi("banner", { busy: true });

      const bannerData = await uploadProfileMedia("banner", pendingProfileMedia.banner.file);
      syncProfileMeta(bannerData);
      mediaEventDetail.bannerUrl = profileMetaState.bannerUrl;
      clearPendingMedia("banner");
    }

    populateProfileMeta();

    window.dispatchEvent(
      new CustomEvent("mgl:settings-saved", {
        detail: { settings: data?.settings }
      })
    );

    if (Object.keys(mediaEventDetail).length) {
      window.dispatchEvent(
        new CustomEvent("mgl:profile-media-updated", {
          detail: mediaEventDetail
        })
      );
    }

    if (usernameResult.error) {
      showToast({
        title: "Partially saved",
        message: `Your settings were saved, but the username was not changed: ${usernameResult.error.message}`,
        type: "warning"
      });
    } else {
      const parts = [];

      if (usernameResult.changed) parts.push("username");
      if (Object.keys(mediaEventDetail).length) parts.push("profile media");
      parts.push("settings");

      showToast({
        title: "Settings saved",
        message: `Updated: ${parts.join(", ")}.`,
        type: "success"
      });
    }
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

function getCropEls() {
  return {
    overlay: document.getElementById("settingsCropOverlay"),
    title: document.getElementById("settingsCropTitle"),
    subtitle: document.getElementById("settingsCropSubtitle"),
    closeBtn: document.getElementById("settingsCropClose"),
    frame: document.getElementById("settingsCropFrame"),
    image: document.getElementById("settingsCropImage"),
    zoomRange: document.getElementById("settingsCropZoomRange"),
    zoomValue: document.getElementById("settingsCropZoomValue"),
    zoomOut: document.getElementById("settingsCropZoomOut"),
    zoomIn: document.getElementById("settingsCropZoomIn"),
    cancelBtn: document.getElementById("settingsCropCancel"),
    confirmBtn: document.getElementById("settingsCropConfirm")
  };
}

function isCropOpen() {
  return Boolean(cropState.type) && !getCropEls().overlay?.hidden;
}

function revokeCropObjectUrl() {
  if (cropState.objectUrl) {
    URL.revokeObjectURL(cropState.objectUrl);
    cropState.objectUrl = null;
  }
}

function resetCropState() {
  cropState.type = null;
  cropState.image = null;
  cropState.naturalWidth = 0;
  cropState.naturalHeight = 0;
  cropState.frameWidth = 0;
  cropState.frameHeight = 0;
  cropState.minScale = 1;
  cropState.maxScale = 1;
  cropState.scale = 1;
  cropState.offsetX = 0;
  cropState.offsetY = 0;
  cropState.dragging = false;
  cropState.pointerId = null;
  cropState.dragStartX = 0;
  cropState.dragStartY = 0;
  cropState.dragOriginX = 0;
  cropState.dragOriginY = 0;
}

function closeCropper() {
  const els = getCropEls();

  if (cropState.type) {
    const input = getUploadEls(cropState.type).input;
    if (input) input.value = "";
  }

  if (els.overlay) {
    els.overlay.hidden = true;
  }

  if (els.image) {
    els.image.removeAttribute("src");
    els.image.style.transform = "";
    els.image.style.width = "";
    els.image.style.height = "";
  }

  revokeCropObjectUrl();
  resetCropState();
}

function clampCropOffsets() {
  const displayWidth = cropState.naturalWidth * cropState.scale;
  const displayHeight = cropState.naturalHeight * cropState.scale;

  const maxX = Math.max(0, (displayWidth - cropState.frameWidth) / 2);
  const maxY = Math.max(0, (displayHeight - cropState.frameHeight) / 2);

  cropState.offsetX = Math.min(maxX, Math.max(-maxX, cropState.offsetX));
  cropState.offsetY = Math.min(maxY, Math.max(-maxY, cropState.offsetY));
}

function renderCropPreview() {
  const els = getCropEls();
  if (!els.image || !cropState.type) return;

  clampCropOffsets();

  els.image.style.width = `${cropState.naturalWidth}px`;
  els.image.style.height = `${cropState.naturalHeight}px`;
  els.image.style.transform =
    `translate(-50%, -50%) translate(${cropState.offsetX}px, ${cropState.offsetY}px) scale(${cropState.scale})`;
}

function updateCropZoomLabel(percent) {
  const els = getCropEls();
  if (els.zoomValue) {
    els.zoomValue.textContent = `${Math.round(percent)}%`;
  }
}

function setCropZoomPercent(percent) {
  const els = getCropEls();
  if (!cropState.type || !els.zoomRange) return;

  const clampedPercent = Math.min(400, Math.max(100, percent));
  cropState.scale = Math.min(
    cropState.maxScale,
    Math.max(cropState.minScale, cropState.minScale * (clampedPercent / 100))
  );

  els.zoomRange.value = String(clampedPercent);
  updateCropZoomLabel(clampedPercent);
  renderCropPreview();
}

function recalculateCropBounds() {
  const els = getCropEls();
  if (!cropState.type || !els.frame || !els.zoomRange) return;

  const percent = Number(els.zoomRange.value || 100);
  const rect = els.frame.getBoundingClientRect();

  cropState.frameWidth = rect.width;
  cropState.frameHeight = rect.height;
  cropState.minScale = Math.max(
    cropState.frameWidth / cropState.naturalWidth,
    cropState.frameHeight / cropState.naturalHeight
  );
  cropState.maxScale = cropState.minScale * 4;

  cropState.scale = Math.min(
    cropState.maxScale,
    Math.max(cropState.minScale, cropState.minScale * (percent / 100))
  );

  renderCropPreview();
}

function getCropOutputOptions(type) {
  if (type === "avatar") {
    return {
      width: 512,
      height: 512,
      filename: "avatar.webp"
    };
  }

  return {
    width: 1500,
    height: 500,
    filename: "banner.webp"
  };
}

async function createCroppedMediaFile(type) {
  const { width, height, filename } = getCropOutputOptions(type);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not prepare image canvas");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const displayWidth = cropState.naturalWidth * cropState.scale;
  const displayHeight = cropState.naturalHeight * cropState.scale;

  const imageLeft = (cropState.frameWidth / 2) + cropState.offsetX - (displayWidth / 2);
  const imageTop = (cropState.frameHeight / 2) + cropState.offsetY - (displayHeight / 2);

  const sx = (0 - imageLeft) / cropState.scale;
  const sy = (0 - imageTop) / cropState.scale;
  const sWidth = cropState.frameWidth / cropState.scale;
  const sHeight = cropState.frameHeight / cropState.scale;

  ctx.drawImage(
    cropState.image,
    sx,
    sy,
    sWidth,
    sHeight,
    0,
    0,
    width,
    height
  );

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) {
        reject(new Error("Could not export cropped image"));
        return;
      }
      resolve(result);
    }, "image/webp", 0.92);
  });

  const file = new File([blob], filename, { type: "image/webp" });
  const previewUrl = URL.createObjectURL(blob);

  return { file, previewUrl };
}

async function loadImageFromObjectUrl(objectUrl) {
  return await new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load selected image"));

    image.src = objectUrl;
  });
}

async function openCropper(type, file) {
  const els = getCropEls();
  if (!els.overlay || !els.frame || !els.image || !els.zoomRange) return;

  closeCropper();

  const objectUrl = URL.createObjectURL(file);
  const image = await loadImageFromObjectUrl(objectUrl);

  cropState.type = type;
  cropState.objectUrl = objectUrl;
  cropState.image = image;
  cropState.naturalWidth = image.naturalWidth;
  cropState.naturalHeight = image.naturalHeight;

  els.title.textContent = type === "avatar" ? "Adjust Profile Picture" : "Adjust Profile Banner";
  els.subtitle.textContent =
    type === "avatar"
      ? "Drag the image to position it and use the slider to zoom."
      : "Drag the banner into place and use the slider to zoom.";

  els.frame.classList.toggle("settings-crop-frame--avatar", type === "avatar");
  els.frame.classList.toggle("settings-crop-frame--banner", type === "banner");

  els.image.src = objectUrl;
  els.zoomRange.value = "100";
  updateCropZoomLabel(100);

  els.overlay.hidden = false;

  requestAnimationFrame(() => {
    recalculateCropBounds();
    cropState.offsetX = 0;
    cropState.offsetY = 0;
    setCropZoomPercent(100);
  });
}

async function confirmCropperSelection() {
  if (!cropState.type) return;

  const type = cropState.type;
  const { file, previewUrl } = await createCroppedMediaFile(type);

  setPendingMedia(type, file, previewUrl);
  closeCropper();

  showToast({
    title: type === "avatar" ? "Picture ready" : "Banner ready",
    message: "The new image is ready. It will be uploaded when you click Save Changes.",
    type: "success"
  });
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

async function openSettings() {
  const settingsOverlay = getOverlay();
  if (!settingsOverlay) return;

  closeCropper();
  clearAllPendingMedia();

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

  closeCropper();
  clearAllPendingMedia();

  settingsOverlay.hidden = true;
  settingsOverlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function handleCropPointerDown(e) {
  if (!cropState.type) return;
  if (e.pointerType === "mouse" && e.button !== 0) return;

  cropState.dragging = true;
  cropState.pointerId = e.pointerId;
  cropState.dragStartX = e.clientX;
  cropState.dragStartY = e.clientY;
  cropState.dragOriginX = cropState.offsetX;
  cropState.dragOriginY = cropState.offsetY;

  e.preventDefault();
}

function handleCropPointerMove(e) {
  if (!cropState.dragging || cropState.pointerId !== e.pointerId) return;

  cropState.offsetX = cropState.dragOriginX + (e.clientX - cropState.dragStartX);
  cropState.offsetY = cropState.dragOriginY + (e.clientY - cropState.dragStartY);

  renderCropPreview();
}

function handleCropPointerUp(e) {
  if (cropState.pointerId !== e.pointerId) return;

  cropState.dragging = false;
  cropState.pointerId = null;
}

function handleCropWheel(e) {
  if (!isCropOpen()) return;

  e.preventDefault();

  const els = getCropEls();
  const current = Number(els.zoomRange?.value || 100);
  const next = current + (e.deltaY < 0 ? 10 : -10);

  setCropZoomPercent(next);
}

function bindCropper() {
  const els = getCropEls();
  if (!els.overlay || els.overlay.dataset.bound === "true") return;

  els.overlay.dataset.bound = "true";

  els.closeBtn?.addEventListener("click", closeCropper);
  els.cancelBtn?.addEventListener("click", closeCropper);

  els.confirmBtn?.addEventListener("click", async () => {
    try {
      await confirmCropperSelection();
    } catch (err) {
      console.error(err);

      showToast({
        title: "Image processing failed",
        message: err.message || "Could not prepare the selected image.",
        type: "error"
      });
    }
  });

  els.zoomRange?.addEventListener("input", () => {
    setCropZoomPercent(Number(els.zoomRange.value || 100));
  });

  els.zoomOut?.addEventListener("click", () => {
    const current = Number(els.zoomRange?.value || 100);
    setCropZoomPercent(current - 10);
  });

  els.zoomIn?.addEventListener("click", () => {
    const current = Number(els.zoomRange?.value || 100);
    setCropZoomPercent(current + 10);
  });

  els.frame?.addEventListener("pointerdown", handleCropPointerDown);
  els.frame?.addEventListener("wheel", handleCropWheel, { passive: false });

  window.addEventListener("pointermove", handleCropPointerMove);
  window.addEventListener("pointerup", handleCropPointerUp);
  window.addEventListener("pointercancel", handleCropPointerUp);

  window.addEventListener("resize", () => {
    if (isCropOpen()) {
      requestAnimationFrame(() => {
        recalculateCropBounds();
      });
    }
  });
}

function validateSelectedImage(file) {
  if (!file) {
    throw new Error("No file selected");
  }

  const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
  if (!allowedTypes.has(file.type)) {
    throw new Error("Please choose a PNG, JPG or WEBP image");
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("The selected image is too large. Maximum size is 8 MB");
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

  bindCropper();

  document.addEventListener("click", async (e) => {
    const openTrigger = e.target.closest("[data-open-settings]");
    if (openTrigger) {
      e.preventDefault();
      closeUserDropdownIfOpen();
      await openSettings();
      return;
    }

    const closeTrigger = e.target.closest("[data-close-settings]");
    if (closeTrigger && !isCropOpen()) {
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
      validateSelectedImage(file);
      await openCropper(type, file);
    } catch (err) {
      console.error(err);

      input.value = "";

      showToast({
        title: "Image rejected",
        message: err.message || "Could not open the selected image.",
        type: "error"
      });
    }
  });

  if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener("click", () => {
      if (isCropOpen()) {
        closeCropper();
        return;
      }
      closeSettings();
    });
  }

  if (cancelSettingsBtn) {
    cancelSettingsBtn.addEventListener("click", () => {
      if (isCropOpen()) {
        closeCropper();
        return;
      }
      closeSettings();
    });
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
    if (e.key !== "Escape") return;

    if (isCropOpen()) {
      closeCropper();
      return;
    }

    if (settingsOverlay && !settingsOverlay.hidden) {
      closeSettings();
    }
  });

  if (bioField) {
    bioField.addEventListener("input", updateBioCounter);
  }

  setupTabs();
  isInitialized = true;
}