import { API_BASE_URL } from "../backend/config.js";
import { fetchWithAuth, getAccessToken, clearAccessToken, bootstrapAuth } from "./global/authClient.js";
import { showToast } from "./global/toast.js";

const MAX_FILES = 3;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg"]);

let selectedFiles = [];
let currentUser = null;
let isSubmitting = false;

function qs(id) {
  return document.getElementById(id);
}

function notifyError(message) {
  showToast({
    title: "Ticket Error",
    message,
    type: "error"
  });
}

function notifySuccess(message) {
  showToast({
    title: "Ticket submitted",
    message,
    type: "success"
  });
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "0 MB";
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function setModalOpen(open) {
  const modal = qs("bugReportModal");
  if (!modal) return;

  modal.classList.toggle("hidden", !open);
  modal.setAttribute("aria-hidden", open ? "false" : "true");

  document.body.classList.toggle("support-modal-open", open);

  if (open) {
    setTimeout(() => qs("bugSubject")?.focus(), 50);
  }
}

function clearStatus() {
  const status = qs("bugReportStatus");
  if (!status) return;

  status.hidden = true;
  status.textContent = "";
  status.classList.remove("success", "error");
}

function showStatus(message, type = "error") {
  const status = qs("bugReportStatus");
  if (!status) return;

  status.hidden = false;
  status.textContent = message;
  status.classList.remove("success", "error");
  status.classList.add(type);
}

function updateCounter() {
  const textarea = qs("bugMessage");
  const counter = qs("bugMessageCounter");
  if (!textarea || !counter) return;

  counter.textContent = `${textarea.value.length} / 4000`;

  counter.classList.toggle("limit-near", textarea.value.length >= 3600 && textarea.value.length < 4000);
  counter.classList.toggle("limit-hit", textarea.value.length >= 4000);
}

function resetForm() {
  const form = qs("bugReportForm");
  const fileInput = qs("bugScreenshots");

  if (form) form.reset();
  if (fileInput) fileInput.value = "";

  selectedFiles = [];
  updateFileList();
  updateCounter();
  clearStatus();
}

function closeModal() {
  if (isSubmitting) return;
  setModalOpen(false);
  resetForm();
}

function validateForm(subject, message) {
  if (subject.length < 5) {
    return {
      message: "Subject must be at least 5 characters.",
      fieldId: "bugSubject"
    };
  }

  if (subject.length > 120) {
    return {
      message: "Subject must be 120 characters or less.",
      fieldId: "bugSubject"
    };
  }

  if (message.length < 20) {
    return {
      message: "Description must be at least 20 characters.",
      fieldId: "bugMessage"
    };
  }

  if (message.length > 4000) {
    return {
      message: "Description must be 4000 characters or less.",
      fieldId: "bugMessage"
    };
  }

  return null;
}

function updateFileList() {
  const list = qs("bugFileList");
  if (!list) return;

  list.innerHTML = "";

  if (!selectedFiles.length) return;

  selectedFiles.forEach((file, index) => {
    const item = document.createElement("div");
    item.className = "support-file-item";

    const info = document.createElement("div");
    info.className = "support-file-info";

    const icon = document.createElement("i");
    icon.className = "fa-regular fa-image";

    const name = document.createElement("span");
    name.className = "support-file-name";
    name.textContent = file.name;

    const size = document.createElement("small");
    size.className = "support-file-size";
    size.textContent = formatBytes(file.size);

    info.appendChild(icon);
    info.appendChild(name);
    info.appendChild(size);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "support-file-remove";
    removeBtn.setAttribute("aria-label", `Remove ${file.name}`);
    removeBtn.innerHTML = `<i class="fa-solid fa-xmark"></i>`;

    removeBtn.addEventListener("click", () => {
      selectedFiles.splice(index, 1);

      const input = qs("bugScreenshots");
      if (input && selectedFiles.length === 0) {
        input.value = "";
      }

      updateFileList();
      clearStatus();
    });

    item.appendChild(info);
    item.appendChild(removeBtn);
    list.appendChild(item);
  });
}

function handleFiles(files) {
  const incoming = Array.from(files || []);

  if (selectedFiles.length + incoming.length > MAX_FILES) {
    notifyError(`You can upload at most ${MAX_FILES} screenshots.`);
    return;
  }

  for (const file of incoming) {
    if (!ALLOWED_TYPES.has(file.type)) {
      notifyError("Only PNG and JPEG screenshots are allowed.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      notifyError(`"${file.name}" is too large. Each screenshot may be at most 5 MB.`);
      return;
    }
  }

  selectedFiles = [...selectedFiles, ...incoming];
  clearStatus();
  updateFileList();
}

function setSubmitting(submitting) {
  isSubmitting = submitting;

  const submitBtn = qs("submitBugReportBtn");
  const cancelBtn = qs("cancelBugReportBtn");
  const closeBtn = qs("closeBugReportBtn");

  if (submitBtn) {
    submitBtn.disabled = submitting;
    submitBtn.textContent = submitting ? "Submitting..." : "Submit Ticket";
  }

  if (cancelBtn) cancelBtn.disabled = submitting;
  if (closeBtn) closeBtn.disabled = submitting;
}

async function loadCurrentUser() {
  if (!getAccessToken()) {
    currentUser = null;
    return null;
  }

  try {
    const res = await fetchWithAuth("/api/users/me", {
      method: "GET"
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : {};

    if (res.status === 401) {
      clearAccessToken();
      currentUser = null;
      return null;
    }

    if (!res.ok) {
      currentUser = null;
      return null;
    }

    currentUser = data;
    return data;
  } catch (err) {
    console.error("Could not load current user:", err);
    currentUser = null;
    return null;
  }
}

async function submitBugReport(event) {
  event.preventDefault();

  if (isSubmitting) return;

  if (!getAccessToken()) {
    notifyError("Please log in before submitting a bug report.");
    return;
  }

  const subject = qs("bugSubject")?.value.trim() || "";
  const message = qs("bugMessage")?.value.trim() || "";

  const validationError = validateForm(subject, message);

  if (validationError) {
    notifyError(validationError.message);

    const field = qs(validationError.fieldId);
    if (field) field.focus();

    return;
  }

  clearStatus();
  setSubmitting(true);

  try {
    if (!currentUser) {
      await loadCurrentUser();
    }

    const formData = new FormData();

    formData.append("subject", subject);
    formData.append("message", message);
    formData.append("pageUrl", window.location.href);
    formData.append("browserInfo", navigator.userAgent || "");

    if (currentUser?.username) {
      formData.append("username", currentUser.username);
    }

    if (currentUser?.id) {
      formData.append("userId", currentUser.id);
    }

    if (currentUser?.email) {
      formData.append("email", currentUser.email);
    }

    selectedFiles.forEach((file) => {
      formData.append("screenshots", file);
    });

    const res = await fetchWithAuth("/api/support/bug-report", {
      method: "POST",
      body: formData
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : {};

    if (res.status === 401) {
      clearAccessToken();
      notifyError("Your session expired. Please log in again.");
      return;
    }

    if (!res.ok) {
      throw new Error(data?.message || `Request failed (${res.status})`);
    }

    notifySuccess(`Ticket #${data.ticketNumber} was submitted successfully.`);
    showStatus(`Ticket #${data.ticketNumber} was submitted successfully.`, "success");

    resetForm();
    setModalOpen(false);
  } catch (err) {
    console.error("Bug report submit failed:", err);
    notifyError(err.message || "Failed to submit bug report.");
    showStatus(err.message || "Failed to submit bug report.", "error");
  } finally {
    setSubmitting(false);
  }
}

function setupDragAndDrop() {
  const drop = document.querySelector(".support-file-drop");
  const input = qs("bugScreenshots");

  if (!drop || !input) return;

  ["dragenter", "dragover"].forEach((eventName) => {
    drop.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();
      drop.classList.add("is-dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    drop.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();
      drop.classList.remove("is-dragging");
    });
  });

  drop.addEventListener("drop", (event) => {
    handleFiles(event.dataTransfer?.files);
    input.value = "";
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await bootstrapAuth();
  await loadCurrentUser();

  qs("openBugReportBtn")?.addEventListener("click", () => {
    clearStatus();
    setModalOpen(true);
  });

  qs("closeBugReportBtn")?.addEventListener("click", closeModal);
  qs("cancelBugReportBtn")?.addEventListener("click", closeModal);

  document.querySelectorAll("[data-close-bug-modal]").forEach((el) => {
    el.addEventListener("click", closeModal);
  });

  qs("bugReportForm")?.addEventListener("submit", submitBugReport);

  qs("bugMessage")?.addEventListener("input", () => {
    updateCounter();
    clearStatus();
  });

  qs("bugSubject")?.addEventListener("input", clearStatus);

  qs("bugScreenshots")?.addEventListener("change", (event) => {
    handleFiles(event.target.files);
    event.target.value = "";
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const modal = qs("bugReportModal");
      const isOpen = modal && !modal.classList.contains("hidden");
      if (isOpen) closeModal();
    }
  });

  setupDragAndDrop();
  updateCounter();
});