// ===== Read More / Read Less Buttons =====
document.querySelectorAll(".review-box").forEach(box => {
  const btn = box.querySelector(".review-readmore-btn");
  const content = box.querySelector(".review-middle");
  if (!btn || !content) return;

  const textLength = content.textContent.trim().length;

  if (textLength <= 700) {
    content.classList.add("expanded");
    btn.style.display = "none";
    return;
  }

  btn.style.display = "inline-block";
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

// ===== Reactions Hover =====
document.querySelectorAll(".review-box").forEach(box => {
  const hoverMenu = box.querySelector(".review-hover-menu");
  const bar = box.querySelector(".reaction-bar");
  if (!hoverMenu || !bar) return;

  const items = hoverMenu.querySelectorAll(".reaction-item");
  const state = new Map();
  const userReactions = new Map();

  function render() {
    bar.innerHTML = "";
    state.forEach((count, emoji) => {
      const el = document.createElement("div");
      el.className = "reaction-badge";
      el.textContent = `${emoji} ${count}`;
      if (userReactions.get(emoji)) el.style.outline = "2px solid #3b82f6";

      el.addEventListener("click", () => {
        const next = count - 1;
        if (next <= 0) state.delete(emoji);
        else state.set(emoji, next);
        userReactions.delete(emoji);
        render();
      });

      bar.appendChild(el);
    });
  }

  items.forEach(item => {
    item.addEventListener("click", e => {
      e.stopPropagation();
      const emoji = item.dataset.emoji;
      if (userReactions.get(emoji)) return;

      state.set(emoji, (state.get(emoji) || 0) + 1);
      userReactions.set(emoji, true);
      render();
    });
  });
});

// ===== Alle Dropdowns (inkl. Rating + Recommendation) =====
document.querySelectorAll('.gamereview-dropdown').forEach(dropdown => {
  const btn = dropdown.querySelector('.gamereview-dropdown-btn');
  const menu = dropdown.querySelector('.gamereview-dropdown-menu');
  const items = dropdown.querySelectorAll('.gamereview-dropdown-item');

  // Menü toggle
  btn.addEventListener('click', e => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  });

  // Auswahl anklicken
  items.forEach(item => {
    item.addEventListener('click', () => {
      const value = item.getAttribute('data-value');
      btn.textContent = value; // Button zeigt Auswahl

      // Statusklasse nur für Recommendation Dropdown
      btn.classList.remove('state-recommended', 'state-mixed', 'state-not');
      if (dropdown.id === 'gamereviewDropdown' && value) {
        btn.classList.add(`state-${value}`);
      }

      // Markierung für Item
      items.forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');

      // Dropdown schließen
      dropdown.classList.remove('open');
    });
  });
});

// Klick außerhalb schließt alle Dropdowns
document.addEventListener('click', () => {
  document.querySelectorAll('.gamereview-dropdown').forEach(dd => {
    dd.classList.remove('open');
  });
});
