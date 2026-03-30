// review.js
export function initReviewModal() {
    const overlay = document.getElementById("reviewOverlay");
    const openBtn = document.getElementById("btnReview");
    const closeBtn = document.getElementById("closeReview");
    const editor = document.getElementById("editor");
    const btnBold = document.getElementById("btnBold");
    const btnItalic = document.getElementById("btnItalic");
    const btnUnderline = document.getElementById("btnUnderline");
    const btnReset = document.getElementById("btnReset");
    const dropdownBtn = document.querySelector("#reviewDropdown .review-dropdown-btn");
    const dropdownMenu = document.querySelector("#reviewDropdown .review-dropdown-menu");

    if (!overlay || !openBtn || !closeBtn || !editor) return;

    // Initialize dropdown
    initDropdown();

    // Open/close overlay
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

    // Reset button functionality
    if (btnReset && dropdownBtn) {
        btnReset.addEventListener("click", () => {
            dropdownBtn.textContent = "Choose...";
            dropdownBtn.classList.remove("recommended", "mixed", "not");
            editor.classList.remove("recommended", "mixed", "not");
        });
    }

    // Function to update toolbar button active states
    function updateToolbar() {
        btnBold.classList.toggle("active", document.queryCommandState("bold"));
        btnItalic.classList.toggle("active", document.queryCommandState("italic"));
        btnUnderline.classList.toggle("active", document.queryCommandState("underline"));
    }

    // Function to handle dropdown behavior
    function initDropdown() {
        if (!dropdownBtn || !dropdownMenu) return;

        // Open/close dropdown
        dropdownBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const isOpen = getComputedStyle(dropdownMenu).display === "flex";
            dropdownMenu.style.display = isOpen ? "none" : "flex";
        });

        // Select dropdown item
        dropdownMenu.querySelectorAll(".review-dropdown-item").forEach(item => {
            item.addEventListener("click", (e) => {
                e.stopPropagation();
                const value = item.dataset.value;
                dropdownBtn.textContent = item.textContent.replace(/\?$/, '');
                dropdownBtn.classList.remove("recommended", "mixed", "not");
                editor.classList.remove("recommended", "mixed", "not");
                if (value) {
                    dropdownBtn.classList.add(value);
                    editor.classList.add(value);
                }
                dropdownMenu.style.display = "none";
            });
        });

        // Clicking outside closes the dropdown
        document.addEventListener("click", () => {
            dropdownMenu.style.display = "none";
        });
    }
}