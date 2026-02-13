document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");

  const loginBtn = document.getElementById("loginBtn");
  const userIcon = document.getElementById("userIcon");

  if (token) {
    loginBtn.style.display = "none";
    userIcon.style.display = "block";
  } else {
    loginBtn.style.display = "block";
    userIcon.style.display = "none";
  }
});