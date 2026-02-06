export function createModalController(options) {
  const { modal, titleElement, headerElement, cardElement, closeButton } = options;
  let isDragging = false;
  let dragStart = { x: 0, y: 0 };
  let modalStart = { x: 0, y: 0 };
  let lastActiveElement = null;

  if (modal) {
    if (!modal.hasAttribute("role")) {
      modal.setAttribute("role", "dialog");
    }
    if (!modal.hasAttribute("aria-modal")) {
      modal.setAttribute("aria-modal", "true");
    }
    if (!modal.hasAttribute("tabindex")) {
      modal.setAttribute("tabindex", "-1");
    }
  }

  function resetPosition() {
    if (cardElement) {
      cardElement.style.transform = "";
    }
  }

  function getFirstFocusable(container) {
    if (!container) {
      return null;
    }
    const candidates = container.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    for (const el of candidates) {
      if (el instanceof HTMLElement && !el.hasAttribute("disabled")) {
        return el;
      }
    }
    return null;
  }

  function open(title) {
    if (titleElement && title !== undefined) {
      titleElement.textContent = title;
    }
    resetPosition();
    lastActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modal.classList.add("open");
    requestAnimationFrame(() => {
      const nextFocus =
        (closeButton instanceof HTMLElement ? closeButton : null) ||
        getFirstFocusable(cardElement) ||
        getFirstFocusable(modal);
      nextFocus?.focus();
    });
  }

  function close() {
    modal.classList.remove("open");
    requestAnimationFrame(() => {
      lastActiveElement?.focus?.();
      lastActiveElement = null;
    });
  }

  closeButton?.addEventListener("click", () => {
    close();
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      close();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("open")) {
      close();
    }
  });

  headerElement?.addEventListener("mousedown", (event) => {
    isDragging = true;
    dragStart = { x: event.clientX, y: event.clientY };
    const rect = cardElement.getBoundingClientRect();
    modalStart = { x: rect.left, y: rect.top };
    event.preventDefault();
  });

  document.addEventListener("mousemove", (event) => {
    if (!isDragging || !cardElement) {
      return;
    }
    const deltaX = event.clientX - dragStart.x;
    const deltaY = event.clientY - dragStart.y;
    const nextX = modalStart.x + deltaX;
    const nextY = modalStart.y + deltaY;
    cardElement.style.transform = `translate(${nextX - cardElement.offsetLeft}px, ${nextY - cardElement.offsetTop}px)`;
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
  });

  return {
    open,
    close,
    resetPosition
  };
}
