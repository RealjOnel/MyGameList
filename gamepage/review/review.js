// review.js
export function initReviewModal() {
    const overlay = document.getElementById("reviewOverlay");
    const openBtn = document.getElementById("btnReview");
    const closeBtn = document.getElementById("closeReview");
    const editor = document.getElementById("editor");
    const btnBold = document.getElementById("btnBold");
    const btnItalic = document.getElementById("btnItalic");
    const btnUnderline = document.getElementById("btnUnderline");

    if (!overlay || !openBtn || !closeBtn || !editor) return;

    // 👉 Dropdown direkt hier initialisieren
    initDropdown();

    openBtn.addEventListener("click", () => {
        overlay.classList.remove("hidden");
        editor.focus();
        updateToolbar();
    });

    closeBtn.addEventListener("click", () => overlay.classList.add("hidden"));
    overlay.querySelector(".review-backdrop").addEventListener("click", () => overlay.classList.add("hidden"));

    // Toolbar buttons
    btnBold.addEventListener("click", () => { document.execCommand('bold'); editor.focus(); updateToolbar(); });
    btnItalic.addEventListener("click", () => { document.execCommand('italic'); editor.focus(); updateToolbar(); });
    btnUnderline.addEventListener("click", () => { document.execCommand('underline'); editor.focus(); updateToolbar(); });

    // Update toolbar on typing/selection
    editor.addEventListener("keyup", updateToolbar);
    editor.addEventListener("mouseup", updateToolbar);
}

function updateToolbar() {
    document.getElementById("btnBold").classList.toggle("active", document.queryCommandState("bold"));
    document.getElementById("btnItalic").classList.toggle("active", document.queryCommandState("italic"));
    document.getElementById("btnUnderline").classList.toggle("active", document.queryCommandState("underline"));
}

// Custom Dropdown
function initDropdown() {
    const dropdown = document.getElementById("reviewDropdown");
    if (!dropdown) return;

    const btn = dropdown.querySelector(".dropdown-btn");
    const menu = dropdown.querySelector(".dropdown-menu");

    btn.addEventListener("click", () => {
        const isOpen = getComputedStyle(menu).display === "flex";
        menu.style.display = isOpen ? "none" : "flex";
    });

    menu.querySelectorAll(".dropdown-item").forEach(item => {
        item.addEventListener("click", () => {
            btn.textContent = item.textContent;
            btn.className = "dropdown-btn " + item.dataset.value;
            menu.style.display = "none";
        });
    });

    document.addEventListener("click", (e) => {
        if (!dropdown.contains(e.target)) {
            menu.style.display = "none";
        }
    });
}