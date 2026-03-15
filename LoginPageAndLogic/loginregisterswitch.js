import { API_BASE_URL } from "../backend/config.js";

const form = document.getElementById("auth-form");
const errorMsg = document.getElementById("error-msg");

const emailGroup = document.getElementById("email-group");
const confirmGroup = document.getElementById("confirm-password-group");

const title = document.getElementById("auth-title");
const subtitle = document.getElementById("auth-subtitle");
const submitText = document.getElementById("submit-text");

const tabs = document.querySelectorAll(".tab-btn");

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;  /* email validation*/

/* =========================
   SWITCH LOGIN / REGISTER
========================= */

function switchAuth(e, type) {

  tabs.forEach(t => t.classList.remove("active"));
  if (e?.target) e.target.classList.add("active");

  if (type === "register") {

    emailGroup.style.display = "block";
    confirmGroup.style.display = "block";

    title.innerHTML = 'Join the <span class="gradient-text">Gamers!</span>';
    subtitle.textContent = "Create your free MyGameList account.";
    submitText.textContent = "Register";

  } else {

    emailGroup.style.display = "none";
    confirmGroup.style.display = "none";

    title.innerHTML = 'Welcome <span class="gradient-text">Back!</span>';
    subtitle.textContent = "Get back to track your Gaming History.";
    submitText.textContent = "Login";

  }
}

/* =========================
   TAB EVENTS
========================= */

tabs.forEach(btn => {
  btn.addEventListener("click", (e) => {
    switchAuth(e, btn.dataset.type);
  });
});

/* =========================
   FORM SUBMIT
========================= */

form.addEventListener("submit", async (e) => {

  e.preventDefault();

  const isRegister = submitText.textContent === "Register";

  const username = form.querySelector('input[type="text"]').value.trim();
  const password = form.querySelector('input[placeholder="Password"]').value.trim();

  const emailInput = form.querySelector('input[type="email"]');
  const email = emailInput ? emailInput.value.trim() : "";

  const confirmInput = document.querySelector("#confirm-password-group input");
  const confirmPassword = confirmInput ? confirmInput.value.trim() : "";

  /* =========================
     VALIDATION
  ========================= */

  if (!username || !password || (isRegister && !email)) {
    showError("Please fill all required fields");
    return;
  }

  if (isRegister && !emailRegex.test(email)) {
  showError("Please enter a valid email address");
  return;
  }

  if (isRegister && password !== confirmPassword) {
    showError("Passwords do not match");
    return;
  }

  /* =========================
     API REQUEST
  ========================= */

  const endpoint = isRegister
    ? `${API_BASE_URL}/api/register`
    : `${API_BASE_URL}/api/login`;

  try {

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        password,
        email
      })
    });

    const data = await res.json();

    if (!res.ok) {
      showError(data.message || "Something went wrong");
      return;
    }

    console.log("✅ Success:", data);

    localStorage.setItem("token", data.token);

    window.location.href = "../index.html";

  } catch (err) {

    console.error(err);
    showError("Network error");

  }

});

/* =========================
   ERROR HANDLING
========================= */

function showError(msg) {

  errorMsg.style.display = "block";
  errorMsg.textContent = msg;

  errorMsg.classList.remove("shake");
  void errorMsg.offsetWidth;
  errorMsg.classList.add("shake");

}