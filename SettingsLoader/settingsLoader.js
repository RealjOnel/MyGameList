import { initSettingsModal } from "../js/global/settings.js";

let settingsModalPromise = null;

async function ensureSettingsMarkupLoaded() {
  if (document.getElementById("settingsOverlay")) return;

  const htmlUrl = new URL("../SettingsLoader/settings.html", import.meta.url);

  const res = await fetch(htmlUrl.href, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load settings modal (${res.status})`);
  }

  const html = await res.text();
  document.body.insertAdjacentHTML("beforeend", html);
}

async function bootSettings() {
  if (!settingsModalPromise) {
    settingsModalPromise = ensureSettingsMarkupLoaded();
  }

  await settingsModalPromise;
  initSettingsModal();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    bootSettings().catch((err) => {
      console.error("Settings loader failed:", err);
    });
  });
} else {
  bootSettings().catch((err) => {
    console.error("Settings loader failed:", err);
  });
}