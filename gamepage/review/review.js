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

    // Dropdown direkt initialisieren
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

// Custom Dropdown + Editor Sync
function initDropdown() {
    const dropdown = document.getElementById("reviewDropdown");
    if (!dropdown) return;

    const btn = dropdown.querySelector(".dropdown-btn");
    const menu = dropdown.querySelector(".dropdown-menu");
    const editor = document.getElementById("editor");

    // Dropdown öffnen/schließen
    btn.addEventListener("click", (e) => {
        e.stopPropagation(); // verhindert sofortiges Schließen durch Dokument-Listener
        const isOpen = getComputedStyle(menu).display === "flex";
        menu.style.display = isOpen ? "none" : "flex";
    });

    // Items auswählen
    menu.querySelectorAll(".dropdown-item").forEach(item => {
        item.addEventListener("click", (e) => {
            e.stopPropagation();

            // Button oben zeigt nur den reinen Text ohne Fragezeichen
            btn.textContent = item.textContent.replace(/\?$/, '');

            // Alte Klassen entfernen
            btn.classList.remove("recommended", "mixed", "not");
            editor.classList.remove("recommended", "mixed", "not");

            // Neue Klassen nur setzen, wenn ein echter Status ausgewählt wurde
            const value = item.dataset.value;
            if (value) {
                btn.classList.add(value);
                editor.classList.add(value);
            }

            menu.style.display = "none";
        });
    });

    // Klick außerhalb schließt Dropdown
    document.addEventListener("click", () => {
        menu.style.display = "none";
    });
}