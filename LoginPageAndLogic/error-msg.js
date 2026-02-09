/* =========================================
   FORM VALIDATION (NEU)
   ========================================= */

document.getElementById("auth-form").addEventListener("submit", function(e) {
    e.preventDefault();

    const username = document.querySelector("input[type='text']").value.trim();
    const password = document.querySelector("input[type='password']").value.trim();
    const errorBox = document.getElementById("error-msg");

    if (username === "" || password === "") {
        errorBox.style.display = "block";
        errorBox.textContent = "All fields are required!";

        // Animation neu triggern
        errorBox.classList.remove("shake");
        void errorBox.offsetWidth; // force reflow
        errorBox.classList.add("shake");

        return;
    }

    errorBox.style.display = "none";

    alert("Login erfolgreich (Demo)");
});