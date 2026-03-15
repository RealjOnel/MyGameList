import { API_BASE_URL } from "../backend/config.js";
import { showToast } from "../js/global/toast.js";

const commentInput = document.querySelector(".comment_input");
const commentButton = document.querySelector(".comment_button");
const commentList = document.getElementById("profileCommentList");
const commentCounter = document.querySelector(".comment_counter");

function escapeHtml(str = "") {
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[m]));
}

function formatCommentDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function api(path, { method = "GET", body, token } = {}) {
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

function canDeleteComment(comment) {
  const isAuthor =
    comment?.author?.username &&
    window.currentViewerUsername &&
    comment.author.username === window.currentViewerUsername;

  const isProfileOwner =
    window.currentViewerUsername &&
    window.currentProfileUsername &&
    window.currentViewerUsername === window.currentProfileUsername;

  return isAuthor || isProfileOwner;
}

function renderComments(comments = []) {
  if (!commentList) return;

  if (!comments.length) {
    commentList.innerHTML = `<div class="profile_comment_empty">No comments yet.</div>`;
    return;
  }

  commentList.innerHTML = comments.map((comment) => {
    const showDelete = canDeleteComment(comment);

    return `
      <div class="profile_comment_item" data-comment-id="${escapeHtml(comment.id || "")}">
        <img
          class="profile_comment_avatar"
          src="${comment.author?.avatarUrl || "../assets/User/Default_User_Icon.png"}"
          alt="${escapeHtml(comment.author?.username || "User")}"
        >

        <div class="profile_comment_body">
          <div class="profile_comment_head">
            <a
              class="profile_comment_username"
              href="./profile.html?username=${encodeURIComponent(comment.author?.username || "")}"
            >
              ${escapeHtml(comment.author?.username || "Unknown User")}
            </a>

            <span class="profile_comment_time">${escapeHtml(formatCommentDate(comment.createdAt))}</span>

            ${
              showDelete
                ? `<button class="profile_comment_delete" type="button" data-comment-id="${escapeHtml(comment.id || "")}">Delete</button>`
                : ""
            }
          </div>

          <div class="profile_comment_text">${escapeHtml(comment.text || "")}</div>
        </div>
      </div>
    `;
  }).join("");

  bindDeleteButtons();
}

async function loadComments() {
  if (!window.currentProfileUsername) return;

  try {
    const data = await api(`/api/profile-comments/${encodeURIComponent(window.currentProfileUsername)}`);
    renderComments(data.comments || []);
  } catch (err) {
    console.error(err);
    if (commentList) {
      commentList.innerHTML = `<div class="profile_comment_empty">Failed to load comments.</div>`;
    }
  }
}

async function postComment() {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "../../LoginPageAndLogic/login.html";
    return;
  }

  const profileUsername = window.currentProfileUsername;
  const text = String(commentInput?.value || "").trim();

  if (!profileUsername) return;
  if (!text) return;

  if (text.length > 100) {
  showToast({
    title: "Comment too long",
    message: "Comments can be up to 100 characters long.",
    type: "error"
  });
  return;
}

  const oldText = commentButton.textContent;
  commentButton.disabled = true;
  commentButton.textContent = "Posting...";

  try {
    await api(`/api/profile-comments/${encodeURIComponent(profileUsername)}`, {
      method: "POST",
      token,
      body: { text },
    });

    commentInput.value = "";
    commentInput.style.height = "auto";
    if (commentCounter) commentCounter.textContent = "0 / 100";

    await loadComments();
    showToast({
      title: "Comment posted",
      message: "Your comment has been published.",
      type: "success"
    });
  } catch (err) {
    console.error(err);
    showToast({
      title: "Comment failed",
      message: err.message || "Failed to post comment.",
      type: "error"
    });
  } finally {
    commentButton.disabled = false;
    commentButton.textContent = oldText;
  }
}

async function deleteComment(commentId) {
  const token = localStorage.getItem("token");
  if (!token || !commentId) return;

  const ok = await openMglConfirm({
  title: "Delete Comment",
  text: "Do you really want to delete this comment?",
  confirmText: "Delete",
  cancelText: "Cancel",
});

if (!ok) return;

  try {
    await api(`/api/profile-comments/comment/${encodeURIComponent(commentId)}`, {
      method: "DELETE",
      token,
    });

    await loadComments();

    showToast({
      title: "Comment deleted",
      message: "Your comment has been removed.",
      type: "success"
    });
  } catch (err) {
    console.error(err);
    showToast({
      title: "Delete failed",
      message: err.message || "Failed to delete comment.",
      type: "error"
    });
  }
}

function bindDeleteButtons() {
  const buttons = document.querySelectorAll(".profile_comment_delete");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      deleteComment(btn.dataset.commentId).catch(console.error);
    });
  });
}

function initCommentInput() {
  if (!commentInput) return;

  const updateCounter = () => {
    const len = commentInput.value.length;
    if (commentCounter) commentCounter.textContent = `${len} / 100`;
  };

  commentInput.addEventListener("input", function () {
    if (this.value.length > 100) {
      this.value = this.value.slice(0, 100);
    }

    this.style.height = "auto";
    this.style.height = this.scrollHeight + "px";
    updateCounter();
  });

  updateCounter();
}

function initCommentButton() {
  if (!commentButton) return;
  commentButton.addEventListener("click", postComment);
}

document.addEventListener("DOMContentLoaded", () => {
  initCommentInput();
  initCommentButton();

  const waitForProfile = setInterval(() => {
    if (window.currentProfileUsername) {
      clearInterval(waitForProfile);
      loadComments().catch(console.error);
    }
  }, 100);
});