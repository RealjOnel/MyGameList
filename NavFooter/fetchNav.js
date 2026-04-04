async function loadNavbar() {
    const placeholder = document.getElementById("navbar-placeholder");
    if (!placeholder) return;

    try {
        const res = await fetch("/NavFooter/navbar.html", { cache: "no-store" });
        if (!res.ok) {
            throw new Error(`Failed to load navbar: ${res.status}`);
        }

        const data = await res.text();
        placeholder.innerHTML = data;
        placeholder.dataset.loaded = "true";

        requestAnimationFrame(() => {
            if (typeof window.initNavbar === "function") {
                window.initNavbar();
            }

            if (typeof window.initNavSearch === "function") {
                window.initNavSearch();
            }
        });
    } catch (err) {
        console.error("Navbar load error:", err);
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadNavbar, { once: true });
} else {
    loadNavbar();
}