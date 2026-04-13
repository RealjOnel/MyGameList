import { initReviewModal } from "./review.js";

let reviewPromise = null;
let reviewBooted = false;

async function loadReviewHTML() {
    if (document.getElementById("reviewOverlay")) return;

    const res = await fetch("/gamepage/review/review.html", { cache: "no-store" });
    if (!res.ok) {
        throw new Error(`Failed to load review modal (${res.status})`);
    }

    const html = await res.text();
    const tpl = document.createElement("template");
    tpl.innerHTML = html.trim();

    const overlay = tpl.content.querySelector("#reviewOverlay");
    if (!overlay) {
        throw new Error("Review overlay markup not found");
    }

    document.body.appendChild(overlay);
}

async function bootReview() {
    if (!reviewPromise) {
        reviewPromise = loadReviewHTML();
    }

    await reviewPromise;

    if (reviewBooted) return;
    initReviewModal();
    reviewBooted = true;
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        bootReview().catch(console.error);
    });
} else {
    bootReview().catch(console.error);
}