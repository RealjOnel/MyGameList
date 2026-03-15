function openMglConfirm({
  title = "Confirm Action",
  text = "Are you sure?",
  confirmText = "Confirm",
  cancelText = "Cancel",
} = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById("mglConfirmModal");
    const titleEl = document.getElementById("mglConfirmTitle");
    const textEl = document.getElementById("mglConfirmText");
    const okBtn = document.getElementById("mglConfirmOk");
    const cancelBtn = document.getElementById("mglConfirmCancel");

    if (!modal || !titleEl || !textEl || !okBtn || !cancelBtn) {
      resolve(false);
      return;
    }

    titleEl.textContent = title;
    textEl.textContent = text;
    okBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;

    modal.hidden = false;

    const cleanup = () => {
      modal.hidden = true;
      okBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onCancel);
      modal.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKeydown);
    };

    const onConfirm = () => {
      cleanup();
      resolve(true);
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    const onBackdrop = (e) => {
      if (e.target === modal) {
        cleanup();
        resolve(false);
      }
    };

    const onKeydown = (e) => {
      if (e.key === "Escape") {
        cleanup();
        resolve(false);
      }
    };

    okBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onCancel);
    modal.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKeydown);
  });
}