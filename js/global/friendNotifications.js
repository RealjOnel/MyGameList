import { API_BASE_URL } from "../../backend/config.js";
import { showToast } from "./toast.js";

function escapeHtml(str = "") {
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[m]));
}

function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function api(path, { token, method = "GET", body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    throw new Error(data?.message || `Request failed (${res.status})`);
  }

  return data;
}

function getEls() {
  return {
    bellWrap: document.getElementById("friendBell"),
    bellBtn: document.getElementById("friendBellBtn"),
    badge: document.getElementById("friendBellBadge"),
    dropdown: document.getElementById("friendBellDropdown"),
    list: document.getElementById("friendBellList"),
  };
}

function renderEmpty(list, text = "No new notifications.") {
  if (!list) return;
  list.innerHTML = `<div class="notif-empty">${escapeHtml(text)}</div>`;
}

function renderNotifications(notifications = []) {
  const { list } = getEls();
  if (!list) return;

  if (!notifications.length) {
    renderEmpty(list);
    return;
  }

  list.innerHTML = notifications.map((item) => `
    <div class="notif-item" data-request-id="${escapeHtml(item.requestId || "")}">
      <img
        class="notif-avatar"
        src="${item.fromUser?.avatarUrl || "../assets/User/Default_User_Icon.png"}"
        alt="${escapeHtml(item.fromUser?.username || "User")}"
      >

      <div class="notif-body">
        <div class="notif-text">
          <a class="notif-user" href="./profile.html?username=${encodeURIComponent(item.fromUser?.username || "")}">
            ${escapeHtml(item.fromUser?.username || "Unknown User")}
          </a>
          sent you a friend request.
        </div>

        <div class="notif-time">${escapeHtml(formatDateTime(item.createdAt))}</div>

        <div class="notif-actions">
          <button class="notif-action accept" type="button" data-action="accept" data-request-id="${escapeHtml(item.requestId || "")}">
            Accept
          </button>
          <button class="notif-action decline" type="button" data-action="decline" data-request-id="${escapeHtml(item.requestId || "")}">
            Decline
          </button>
        </div>
      </div>
    </div>
  `).join("");

  bindNotificationActions();
}

function updateBadge(count) {
  const { badge } = getEls();
  if (!badge) return;

  const safeCount = Number(count) || 0;

  if (safeCount <= 0) {
    badge.hidden = true;
    badge.textContent = "0";
    return;
  }

  badge.hidden = false;
  badge.textContent = safeCount > 99 ? "99+" : String(safeCount);
}

async function loadNotificationCount() {
  const token = localStorage.getItem("token");
  const { bellWrap } = getEls();

  if (!token) {
    if (bellWrap) bellWrap.hidden = true;
    return;
  }

  if (bellWrap) bellWrap.hidden = false;

  try {
    const data = await api("/api/friends/notifications/count", { token });
    updateBadge(data.count || 0);
  } catch (err) {
    console.error(err);
  }
}

async function loadNotifications() {
  const token = localStorage.getItem("token");
  if (!token) return;

  try {
    const data = await api("/api/friends/notifications", { token });
    const notifications = data.notifications || [];
    renderNotifications(notifications);
    updateBadge(notifications.length);
  } catch (err) {
    console.error(err);
    renderEmpty(getEls().list, "Failed to load notifications.");
  }
}

async function handleNotificationAction(action, requestId) {
  const token = localStorage.getItem("token");
  if (!token || !requestId) return;

  try {
    if (action === "accept") {
      await api(`/api/friends/request/${encodeURIComponent(requestId)}/accept`, {
        method: "POST",
        token,
      });

      showToast({
        title: "Friend request accepted",
        message: "The user has been added to your friends list.",
        type: "success",
      });
    }

    if (action === "decline") {
      await api(`/api/friends/request/${encodeURIComponent(requestId)}/decline`, {
        method: "POST",
        token,
      });

      showToast({
        title: "Friend request declined",
        message: "The request has been removed.",
        type: "success",
      });
    }

    await loadNotifications();
  } catch (err) {
    console.error(err);
    showToast({
      title: "Notification action failed",
      message: err.message || "Something went wrong.",
      type: "error",
    });
  }
}

function bindNotificationActions() {
  const { list } = getEls();
  if (!list) return;

  list.querySelectorAll(".notif-action").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      const requestId = btn.dataset.requestId;
      handleNotificationAction(action, requestId).catch(console.error);
    });
  });
}

function initBellToggle() {
  const { bellBtn, dropdown } = getEls();
  if (!bellBtn || !dropdown) return;

  bellBtn.addEventListener("click", async (e) => {
    e.stopPropagation();

    const willOpen = !dropdown.classList.contains("open");

    document.querySelectorAll(".notif-dropdown.open").forEach((el) => {
      el.classList.remove("open");
      el.setAttribute("aria-hidden", "true");
    });

    if (willOpen) {
      dropdown.classList.add("open");
      dropdown.setAttribute("aria-hidden", "false");
      await loadNotifications();
    }
  });

  document.addEventListener("click", (e) => {
    const { bellWrap, dropdown } = getEls();
    if (!bellWrap || !dropdown) return;

    if (!bellWrap.contains(e.target)) {
      dropdown.classList.remove("open");
      dropdown.setAttribute("aria-hidden", "true");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const { dropdown } = getEls();
      if (!dropdown) return;
      dropdown.classList.remove("open");
      dropdown.setAttribute("aria-hidden", "true");
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  initBellToggle();
  await loadNotificationCount();

  // little polling to update the badge count every 30 seconds in case of new notifications
  setInterval(() => {
    loadNotificationCount().catch(console.error);
  }, 30000);
});