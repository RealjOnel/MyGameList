import { API_BASE_URL } from "../backend/config.js";
import { fetchWithAuth, clearAccessToken, getAccessToken } from "./global/authClient.js";

const LOGIN_URL = "../LoginPageAndLogic/login.html";

const MAX_FILES = 3;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg"]);

let selectedFiles = [];

function qs(id) {
  return document.getElementById(id);
}

function redirectToLogin() {
  window.location.href = LOGIN_URL;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "0 B";

  const units = ["B", "KB", "MB"];
  let value = bytes;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function showStatus(message, type = "error") {
  const box = qs("bugReportStatus");
  if (!box) return;

  box.hidden = false;
  box.textContent = message;
  box.classList.remove("error", "success");
  box.classList.add(type);
}

function clearStatus() {
  const box = qs("bugReportStatus");
  if (!box) return;

  box.hidden = true;
  box.textContent = "";
  box.classList.remove("error", "success");
}

function openBugModal() {
  if (!getAccessToken()) {
    redirectToLogin();
    return;
  }

  const modal = qs("bugReportModal");
  if (!modal) return;

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");

  clearStatus();

  setTimeout(() => {
    qs("bugSubject")?.focus();
  }, 50);
}

function closeBugModal() {
  const modal = qs("bugReportModal");
  if (!modal) return;

  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

function updateCounter() {
  const textarea = qs("bugMessage");
  const counter = qs("bugMessageCounter");
  if (!textarea || !counter) return;

  const length = textarea.value.length;
  counter.textContent = `${length} / 4000`;

  counter.classList.toggle("limit-near", length >= 3600 && length < 4000);
  counter.classList.toggle("limit-hit", length >= 4000);
}

function updateFileList() {
  const list = qs("bugFileList");
  if (!list) return;

  list.innerHTML = "";

  for (const file of selectedFiles) {
    const item = document.createElement("div");
    item.className = "support-file-item";

    const name = document.createElement("span");
    name.textContent = file.name;

    const size = document.createElement("small");
    size.textContent = formatBytes(file.size);

    item.appendChild(name);
    item.appendChild(size);
    list.appendChild(item);
  }
}

function handleFiles(files) {
  const incoming = Array.from(files || []);

  if (incoming.length > MAX_FILES) {
    showStatus(`You can upload at most ${MAX_FILES} screenshots.`);
    return;
  }

  for (const file of incoming) {
    if (!ALLOWED_TYPES.has(file.type)) {
      showStatus("Only PNG and JPEG screenshots are allowed.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      showStatus(`"${file.name}" is too large. Each screenshot may be at most 5 MB.`);
      return;
    }
  }

  selectedFiles = incoming;
  clearStatus();
  updateFileList();
}

function validateForm(subject, message) {
  if (subject.length < 5) return "Subject must be at least 5 characters.";
  if (subject.length > 120) return "Subject must be 120 characters or less.";
  if (message.length < 20) return "Description must be at least 20 characters.";
  if (message.length > 4000) return "Description must be 4000 characters or less.";
  return "";
}

function resetForm() {
  const form = qs("bugReportForm");
  const input = qs("bugScreenshots");

  form?.reset();

  selectedFiles = [];

  if (input) input.value = "";

  updateCounter();
  updateFileList();
  clearStatus();
}

async function submitBugReport(e) {
  e.preventDefault();

  const subject = String(qs("bugSubject")?.value || "").trim();
  const message = String(qs("bugMessage")?.value || "").trim();
  const submitBtn = qs("submitBugReportBtn");

  const validationError = validateForm(subject, message);
  if (validationError) {
    showStatus(validationError);
    return;
  }

  const formData = new FormData();
  formData.append("subject", subject);
  formData.append("message", message);
  formData.append("pageUrl", window.location.href);
  formData.append("browserInfo", navigator.userAgent || "");

  for (const file of selectedFiles) {
    formData.append("screenshots", file);
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";
  }

  clearStatus();

  try {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/support/bug-report`, {
      method: "POST",
      body: formData
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : {};

    if (res.status === 401) {
      clearAccessToken();
      redirectToLogin();
      return;
    }

    if (!res.ok) {
      throw new Error(data?.message || `Request failed (${res.status})`);
    }

    showStatus(`Ticket #${data.ticketNumber} was submitted successfully.`, "success");

    setTimeout(() => {
      resetForm();
      closeBugModal();
    }, 1400);
  } catch (err) {
    console.error("Bug report submit failed:", err);
    showStatus(err.message || "Failed to submit bug report.");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Ticket";
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  qs("openBugReportBtn")?.addEventListener("click", openBugModal);
  qs("closeBugReportBtn")?.addEventListener("click", closeBugModal);
  qs("cancelBugReportBtn")?.addEventListener("click", closeBugModal);

  document.querySelectorAll("[data-close-bug-modal]").forEach((el) => {
    el.addEventListener("click", closeBugModal);
  });

  qs("bugMessage")?.addEventListener("input", updateCounter);

  qs("bugScreenshots")?.addEventListener("change", (e) => {
    handleFiles(e.target.files);
  });

  qs("bugReportForm")?.addEventListener("submit", submitBugReport);

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;

    const modal = qs("bugReportModal");
    if (!modal || modal.classList.contains("hidden")) return;

    closeBugModal();
  });

  updateCounter();
});