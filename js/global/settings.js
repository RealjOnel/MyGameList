const settingsOverlay = document.getElementById("settingsOverlay");
const openSettingsBtn = document.getElementById("openSettingsBtn");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");

function openSettings() {
  if (!settingsOverlay) return;
  settingsOverlay.hidden = false;
  settingsOverlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeSettings() {
  if (!settingsOverlay) return;
  settingsOverlay.hidden = true;
  settingsOverlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

if (openSettingsBtn) {
  openSettingsBtn.addEventListener("click", (e) => {
    e.preventDefault();
    closeUserDropdownIfOpen();
    openSettings();
  });
}

if (closeSettingsBtn) {
  closeSettingsBtn.addEventListener("click", closeSettings);
}

document.addEventListener("click", (e) => {
  const closeTrigger = e.target.closest("[data-close-settings]");
  if (closeTrigger) {
    closeSettings();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && settingsOverlay && !settingsOverlay.hidden) {
    closeSettings();
  }
});

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

/* helper so the user dropdown does not stay open behind the modal */
function closeUserDropdownIfOpen() {
  const userDropdown = document.getElementById("userDropdown");
  if (userDropdown) {
    userDropdown.classList.remove("open");
    userDropdown.setAttribute("aria-hidden", "true");
  }
}