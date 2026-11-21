function ensureToastContainer() {
  let container = document.getElementById("toastContainer");

  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    container.setAttribute("aria-live", "polite");
    container.setAttribute("aria-atomic", "true");
    document.body.appendChild(container);
  }

  return container;
}

export function showToast({
  title = "",
  message = "",
  type = "info",
  duration = 3000,
} = {}) {
  const container = ensureToastContainer();

  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;

  if (title) {
    const titleElement = document.createElement("div");
    titleElement.className = "toast-title";
    titleElement.textContent = String(title);
    toast.appendChild(titleElement);
  }

  const messageElement = document.createElement("div");
  messageElement.className = "toast-message";
  messageElement.textContent = String(message);
  toast.appendChild(messageElement);

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  const removeToast = () => {
    toast.classList.remove("show");
    toast.classList.add("hide");

    setTimeout(() => {
      toast.remove();
    }, 180);
  };

  setTimeout(removeToast, duration);

  return {
    close: removeToast
  };
}