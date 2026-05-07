import { fetchWithAuth, clearAccessToken, getAccessToken, bootstrapAuth } from "../../js/global/authClient.js";
import { showToast } from "../../js/global/toast.js";

const LOGIN_URL = "../../LoginPageAndLogic/login.html";
const MAX_REVIEW_LENGTH = 3000;

const RECOMMENDATION_LABELS = {
    recommended: "Recommended",
    mixed: "Mixed Feelings",
    not: "Not Recommended"
};

let isInitialized = false;

function redirectToLogin() {
    window.location.href = LOGIN_URL;
}

function getCurrentGameId() {
    return new URLSearchParams(window.location.search).get("id");
}

async function apiAuth(path, { method = "GET", body } = {}) {
    const finalPath =
        method === "GET"
            ? `${path}${path.includes("?") ? "&" : "?"}_=${Date.now()}`
            : path;

    const headers = {};
    if (body) headers["Content-Type"] = "application/json";

    const res = await fetchWithAuth(finalPath, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : {};

    if (res.status === 401) {
        clearAccessToken();
        throw new Error("SESSION_EXPIRED");
    }

    if (!res.ok) {
        throw new Error(data?.message || `Request failed (${res.status})`);
    }

    return data;
}

function normalizePlainText(value = "") {
    return String(value)
        .replace(/\u00a0/g, " ")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function getEditorPlainText(editor) {
    return normalizePlainText(editor?.innerText || editor?.textContent || "");
}

function getEditorLength(editor) {
    return getEditorPlainText(editor).length;
}

function updateCharCounter(editor, counter) {
    if (!editor || !counter) return;

    const len = getEditorLength(editor);
    counter.textContent = `${len} / ${MAX_REVIEW_LENGTH}`;
    counter.classList.toggle("limit-near", len >= 2600 && len < MAX_REVIEW_LENGTH);
    counter.classList.toggle("limit-hit", len >= MAX_REVIEW_LENGTH);
}

function setToolbarState(btnBold, btnItalic, btnUnderline) {
    btnBold?.classList.toggle("active", document.queryCommandState("bold"));
    btnItalic?.classList.toggle("active", document.queryCommandState("italic"));
    btnUnderline?.classList.toggle("active", document.queryCommandState("underline"));
}

function applyRecommendation(value, dropdownBtn, editor) {
    dropdownBtn.classList.remove("recommended", "mixed", "not");
    editor.classList.remove("recommended", "mixed", "not");

    if (!value || !RECOMMENDATION_LABELS[value]) {
        dropdownBtn.textContent = "Recommendation";
        dropdownBtn.dataset.value = "";
        return;
    }

    dropdownBtn.textContent = RECOMMENDATION_LABELS[value];
    dropdownBtn.dataset.value = value;
    dropdownBtn.classList.add(value);
    editor.classList.add(value);
}

function fillReviewMeta() {
    const titleEl = document.getElementById("gameTitle");
    const genreEl = document.getElementById("genreChips");
    const statsWrap = document.getElementById("gameStats");

    const title = titleEl?.textContent?.trim() || "this game";

    const genreItems = genreEl
        ? [...genreEl.querySelectorAll(".chip")].map((el) => el.textContent.trim()).filter(Boolean)
        : [];

    const studio = statsWrap?.querySelector(".stats-right .stat:nth-child(2) .v")?.textContent?.trim() || "—";
    const release = statsWrap?.querySelector(".stats-right .stat:nth-child(1) .v")?.textContent?.trim() || "—";

    const titleNode = document.getElementById("reviewModalTitle");
    const genreNode = document.getElementById("reviewMetaGenre");
    const publisherNode = document.getElementById("reviewMetaPublisher");
    const releaseNode = document.getElementById("reviewMetaRelease");

    if (titleNode) titleNode.textContent = `Write a Review for ${title}`;
    if (genreNode) genreNode.textContent = `Genre: ${genreItems.length ? genreItems.join(", ") : "—"}`;
    if (publisherNode) publisherNode.textContent = `Publisher: ${studio}`;
    if (releaseNode) releaseNode.textContent = `Release Date: ${release}`;
}

export function initReviewModal() {
    if (isInitialized) return;
    isInitialized = true;

    const overlay = document.getElementById("reviewOverlay");
    const openBtn = document.getElementById("btnReview");
    const closeBtn = document.getElementById("closeReview");
    const backdrop = overlay?.querySelector(".review-backdrop");

    const editor = document.getElementById("editor");
    const btnBold = document.getElementById("btnBold");
    const btnItalic = document.getElementById("btnItalic");
    const btnUnderline = document.getElementById("btnUnderline");
    const btnReset = document.getElementById("btnReset");
    const submitBtn = document.getElementById("submitReview");
    const counter = document.getElementById("reviewCharCounter");

    const dropdown = document.getElementById("reviewDropdown");
    const dropdownBtn = document.getElementById("reviewRecommendationBtn");
    const dropdownMenu = dropdown?.querySelector(".review-dropdown-menu");

    if (!overlay || !openBtn || !closeBtn || !editor || !submitBtn || !dropdownBtn || !dropdownMenu) {
        return;
    }

    const state = {
        busy: false,
        currentReview: null
    };

    function openOverlay() {
        overlay.classList.remove("hidden");
        overlay.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        fillReviewMeta();
        setTimeout(() => editor.focus(), 0);
    }

    function closeOverlay() {
        overlay.classList.add("hidden");
        overlay.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
        dropdownMenu.style.display = "none";
    }

    function resetForm() {
        editor.innerHTML = "";
        applyRecommendation("", dropdownBtn, editor);
        updateCharCounter(editor, counter);
        submitBtn.textContent = "Submit";
        state.currentReview = null;
    }

    function populateFromReview(review) {
        state.currentReview = review || null;

        if (!review) {
            resetForm();
            return;
        }

        editor.innerHTML = review.html || "";
        applyRecommendation(review.recommendation, dropdownBtn, editor);
        updateCharCounter(editor, counter);
        submitBtn.textContent = "Save Changes";
    }

    async function loadOwnReview() {
        const gameId = getCurrentGameId();
        if (!gameId) throw new Error("Missing game id");

        const data = await apiAuth(`/api/reviews/game/${encodeURIComponent(gameId)}/me`);
        populateFromReview(data?.review || null);
    }

    function execFormat(command) {
        document.execCommand(command, false, null);
        editor.focus();
        setToolbarState(btnBold, btnItalic, btnUnderline);
        updateCharCounter(editor, counter);
    }

    async function handleOpen() {
        await bootstrapAuth();

        if (!getAccessToken()) {
            redirectToLogin();
            return;
        }

        openOverlay();
        resetForm();

        try {
            await loadOwnReview();
            setToolbarState(btnBold, btnItalic, btnUnderline);
        } catch (err) {
            console.error(err);

            if (err.message === "SESSION_EXPIRED") {
                redirectToLogin();
                return;
            }

            showToast({
                title: "Review failed to load",
                message: err.message || "Could not load your review.",
                type: "error"
            });

            closeOverlay();
        }
    }

    async function handleSubmit() {
        if (state.busy) return;

        const gameId = getCurrentGameId();
        const recommendation = dropdownBtn.dataset.value || "";
        const plainText = getEditorPlainText(editor);
        const html = editor.innerHTML;

        if (!gameId) {
            showToast({
                title: "Missing game",
                message: "Game id could not be found.",
                type: "error"
            });
            return;
        }

        if (!recommendation) {
            showToast({
                title: "Recommendation missing",
                message: "Please choose a recommendation before submitting.",
                type: "error"
            });
            return;
        }

        if (!plainText) {
            showToast({
                title: "Review is empty",
                message: "Please write something before submitting.",
                type: "error"
            });
            return;
        }

        if (plainText.length > MAX_REVIEW_LENGTH) {
            showToast({
                title: "Review too long",
                message: `Reviews can be up to ${MAX_REVIEW_LENGTH} characters long.`,
                type: "error"
            });
            return;
        }

        state.busy = true;
        submitBtn.disabled = true;
        submitBtn.textContent = state.currentReview ? "Saving..." : "Submitting...";

        try {
            const data = await apiAuth(`/api/reviews/game/${encodeURIComponent(gameId)}`, {
                method: "PUT",
                body: {
                    recommendation,
                    html
                }
            });

            state.currentReview = data?.review || null;
            populateFromReview(state.currentReview);

            showToast({
                title: "Review saved",
                message: "Your review has been saved successfully.",
                type: "success"
            });

            window.dispatchEvent(
                new CustomEvent("mgl:review-saved", {
                    detail: { review: state.currentReview }
                })
            );

            closeOverlay();
        } catch (err) {
            console.error(err);

            if (err.message === "SESSION_EXPIRED") {
                redirectToLogin();
                return;
            }

            showToast({
                title: "Save failed",
                message: err.message || "Could not save your review.",
                type: "error"
            });
        } finally {
            state.busy = false;
            submitBtn.disabled = false;
            submitBtn.textContent = state.currentReview ? "Save Changes" : "Submit";
        }
    }

    openBtn.addEventListener("click", handleOpen);
    closeBtn.addEventListener("click", closeOverlay);
    backdrop?.addEventListener("click", closeOverlay);

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !overlay.classList.contains("hidden")) {
            closeOverlay();
        }
    });

    btnBold.addEventListener("click", () => execFormat("bold"));
    btnItalic.addEventListener("click", () => execFormat("italic"));
    btnUnderline.addEventListener("click", () => execFormat("underline"));

    editor.addEventListener("keyup", () => {
        setToolbarState(btnBold, btnItalic, btnUnderline);
        updateCharCounter(editor, counter);
    });

    editor.addEventListener("mouseup", () => {
        setToolbarState(btnBold, btnItalic, btnUnderline);
    });

    editor.addEventListener("input", () => {
        updateCharCounter(editor, counter);

        const plainText = getEditorPlainText(editor);
        if (plainText.length > MAX_REVIEW_LENGTH) {
            showToast({
                title: "Character limit reached",
                message: `Reviews can be up to ${MAX_REVIEW_LENGTH} characters long.`,
                type: "error"
            });
        }
    });

    btnReset.addEventListener("click", () => {
        resetForm();
        editor.focus();
    });

    dropdownBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = dropdownMenu.style.display === "flex";
        dropdownMenu.style.display = isOpen ? "none" : "flex";
    });

    dropdownMenu.querySelectorAll(".review-dropdown-item").forEach((item) => {
        item.addEventListener("click", (e) => {
            e.stopPropagation();
            const value = item.dataset.value || "";
            applyRecommendation(value, dropdownBtn, editor);
            dropdownMenu.style.display = "none";
        });
    });

    document.addEventListener("click", (e) => {
        if (!dropdown.contains(e.target)) {
            dropdownMenu.style.display = "none";
        }
    });

    submitBtn.addEventListener("click", handleSubmit);

     window.addEventListener("mgl:open-review-editor", () => {
        handleOpen().catch(console.error);
    });

    resetForm();
}