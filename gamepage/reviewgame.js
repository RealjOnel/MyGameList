  // ===== Read More / Read Less Buttons =====
  document.querySelectorAll(".review-box").forEach(box => {
    const btn = box.querySelector(".review-readmore-btn");
    const content = box.querySelector(".review-middle");
    if (!btn || !content) return;

    btn.addEventListener("click", () => {
      content.classList.toggle("expanded");
      btn.textContent = content.classList.contains("expanded") ? "Read Less" : "Read More";
    });
  });

  // ===== Likes Toggle =====
  document.querySelectorAll(".review-bottom").forEach(container => {
    const defaultImg = container.querySelector(".default");
    const likedImg = container.querySelector(".liked");
    if (!defaultImg || !likedImg) return;

    defaultImg.addEventListener("click", () => {
      defaultImg.hidden = true;
      likedImg.hidden = false;
    });

    likedImg.addEventListener("click", () => {
      likedImg.hidden = true;
      defaultImg.hidden = false;
    });
  });

  // ===== Reactions =====
  document.querySelectorAll(".reaction").forEach(root => {
    const btn = root.querySelector(".reaction-btn");
    const menu = root.querySelector(".reaction-menu");
    const bar = root.querySelector(".reaction-bar");
    const items = root.querySelectorAll(".reaction-item");
    if (!btn || !menu || !bar) return;

    const state = new Map();
    const userReactions = new Map();

    function closeMenu() { menu.classList.remove("open"); }
    function toggleMenu(e) { e.stopPropagation(); menu.classList.toggle("open"); }

    function render() {
      bar.innerHTML = "";
      state.forEach((count, emoji) => {
        const el = document.createElement("div");
        el.className = "reaction-badge";
        el.textContent = `${emoji} ${count}`;
        if (userReactions.get(emoji)) el.style.outline = "2px solid #3b82f6";

        el.addEventListener("click", () => {
          if (userReactions.get(emoji)) {
            const next = count - 1;
            if (next <= 0) state.delete(emoji);
            else state.set(emoji, next);
            userReactions.delete(emoji);
            render();
          }
        });
        bar.appendChild(el);
      });
    }

    items.forEach(item => {
      item.addEventListener("click", e => {
        e.stopPropagation();
        const emoji = item.dataset.emoji;
        if (userReactions.get(emoji)) { closeMenu(); return; }
        state.set(emoji, (state.get(emoji) || 0) + 1);
        userReactions.set(emoji, true);
        render();
        closeMenu();
      });
    });

    btn.addEventListener("click", toggleMenu);

    document.addEventListener("click", e => { if (!root.contains(e.target)) closeMenu(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeMenu(); });
  });
