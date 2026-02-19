/* =========================================
   FORM VALIDATION (NEW)
   ========================================= */

document.getElementById("auth-form").addEventListener("submit", function(e) {
    e.preventDefault();

    const username = document.querySelector("input[type='text']").value.trim();
    const password = document.querySelector("input[type='password']").value.trim();
    const errorBox = document.getElementById("error-msg");

    if (username === "" || password === "") {
        errorBox.style.display = "block";
        errorBox.textContent = "All fields are required!";

        // retrigger animation
        errorBox.classList.remove("shake");
        void errorBox.offsetWidth; // force reflow
        errorBox.classList.add("shake");

        return;
    }
});