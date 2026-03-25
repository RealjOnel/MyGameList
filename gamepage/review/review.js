// Initialize review modal
export function initReviewModal() {
    const overlay = document.getElementById("reviewOverlay");
    const openBtn = document.getElementById("btnReview");
    const closeBtn = document.getElementById("closeReview");
    const editor = document.getElementById("editor");

    if (!overlay || !openBtn || !closeBtn || !editor) return;

    openBtn.addEventListener("click", () => {
        overlay.classList.remove("hidden");
        editor.focus(); // focus editor immediately
    });

    closeBtn.addEventListener("click", () => overlay.classList.add("hidden"));
    overlay.querySelector(".review-backdrop").addEventListener("click", () => overlay.classList.add("hidden"));

    editor.addEventListener("keyup", updateToolbar);   // update toolbar on typing
    editor.addEventListener("mouseup", updateToolbar); // update toolbar on selection change
}

// Global formatting commands
window.formatText = function(command) {
    document.execCommand(command, false, null);
    updateToolbar();
};

// Update toolbar button states
function updateToolbar() {
    document.getElementById("btnBold").classList.toggle("active", document.queryCommandState("bold"));
    document.getElementById("btnItalic").classList.toggle("active", document.queryCommandState("italic"));
    document.getElementById("btnUnderline").classList.toggle("active", document.queryCommandState("underline"));
}

// Auto initialize modal
document.addEventListener("DOMContentLoaded", () => {
    initReviewModal();
});