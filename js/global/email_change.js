import { API_BASE_URL } from "../../backend/config.js";

const titleEl = document.getElementById("emailChangeTitle");
const messageEl = document.getElementById("emailChangeMessage");

function setState(title, message) {
  if (titleEl) titleEl.textContent = title;
  if (messageEl) messageEl.textContent = message;
}

async function verifyEmailChange() {
  const params = new URLSearchParams(window.location.search);
  const token = String(params.get("token") || "").trim();

  if (!token) {
    setState("Invalid link", "This email verification link is missing a token.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/users/email/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({ token })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setState("Verification failed", data?.message || "This verification link is invalid or expired.");
      return;
    }

    setState("Email changed", data?.message || "Your email has been updated successfully.");

    setTimeout(() => {
      window.location.href = "/LoginPageAndLogic/login.html";
    }, 1800);
  } catch (err) {
    console.error(err);
    setState("Verification failed", "A network error occurred while verifying your email change.");
  }
}

document.addEventListener("DOMContentLoaded", verifyEmailChange);