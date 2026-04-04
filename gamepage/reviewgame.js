// ===== Read More / Read Less Buttons =====
document.querySelectorAll(".review-box").forEach(box => {
  const btn = box.querySelector(".review-readmore-btn");
  const content = box.querySelector(".review-middle");
  if (!btn || !content) return;

  const textLength = content.textContent.trim().length;

  // Wenn Text zu kurz → alles anzeigen + Button verstecken
  if (textLength <= 700) {
    content.classList.add("expanded"); // direkt offen
    btn.style.display = "none";
    return;
  }

  // Wenn lang genug → normale Read More Logik
  btn.style.display = "inline-block";

  btn.addEventListener("click", () => {
    content.classList.toggle("expanded");
    btn.textContent = content.classList.contains("expanded")
      ? "Read Less"
      : "Read More";
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

// ===== Reactions (Hover oben rechts) =====
// ===== Reactions Hover-Menü oben rechts =====
document.querySelectorAll(".review-box").forEach(box => {
  const hoverMenu = box.querySelector(".review-hover-menu");
  if (!hoverMenu) return;

  const items = hoverMenu.querySelectorAll(".reaction-item");
  const bar = box.querySelector(".reaction-bar");
  if (!bar) return;

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

const dropdownBtn = document.querySelector('.gamereview-dropdown-btn');
const dropdownMenu = document.querySelector('.gamereview-dropdown-menu');
const dropdownItems = document.querySelectorAll('.gamereview-dropdown-item');

dropdownBtn.addEventListener('click', () => {
  dropdownMenu.style.display = dropdownMenu.style.display === 'flex' ? 'none' : 'flex';
});

// Klick außerhalb schließt das Menü
document.addEventListener('click', (e) => {
  if (!dropdownBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
    dropdownMenu.style.display = 'none';
  }
});

// Auswahl anklicken
dropdownItems.forEach(item => {
  item.addEventListener('click', () => {
    const value = item.getAttribute('data-value');
    const text = item.textContent;
    
    // Button aktualisieren
    dropdownBtn.textContent = text;
    dropdownBtn.classList.add('active');

    // Menü schließen
    dropdownMenu.style.display = 'none';

    // Optional: aktive Klasse bei anderen entfernen
    dropdownItems.forEach(i => i.classList.remove('selected'));
    item.classList.add('selected');

    // Hier kannst du jetzt noch die Reviews filtern nach `value`
    // filterReviews(value);
  });
});
