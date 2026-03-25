import { initReviewModal } from "./review.js";

let reviewPromise = null;

async function loadReviewHTML() {
    if (document.getElementById("reviewOverlay")) return;

    const res = await fetch("/gamepage/review/review.html", { cache: "no-store" });
    const html = await res.text();
    document.body.insertAdjacentHTML("beforeend", html);
}

async function bootReview() {
    if (!reviewPromise) {
        reviewPromise = loadReviewHTML();
    }

    await reviewPromise;
    initReviewModal();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootReview);
} else {
    bootReview();
}