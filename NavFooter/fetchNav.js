async function loadNavbar() {
    const placeholder = document.getElementById("navbar-placeholder");
    if (!placeholder) return;

    try {
        const res = await fetch("/NavFooter/navbar.html");
        if (!res.ok) {
            throw new Error(`Failed to load navbar: ${res.status}`);
        }

        const data = await res.text();
        placeholder.innerHTML = data;

        if (typeof window.initNavbar === "function") {
            window.initNavbar();
        }

        if (typeof window.initNavSearch === "function") {
            window.initNavSearch();
        }
    } catch (err) {
        console.error("Navbar load error:", err);
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadNavbar);
} else {
    loadNavbar();
}