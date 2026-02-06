export function createDialogsController(options) {
  const {
    modal,
    modalController,
    titleElement,
    messageElement,
    inputLabel,
    inputLabelText,
    input,
    form,
    okButton,
    cancelButton,
    closeButton,
    t
  } = options;

  let pendingResolve = null;
  let pendingReject = null;
  let mode = "confirm";

  function settle(result, isError = false) {
    const resolve = pendingResolve;
    const reject = pendingReject;
    pendingResolve = null;
    pendingReject = null;
    if (isError) {
      reject?.(result);
    } else {
      resolve?.(result);
    }
  }

  function cancel() {
    modalController.close();
    if (mode === "prompt") {
      settle(null);
    } else {
      settle(false);
    }
  }

  function openBase(title, message) {
    if (titleElement) {
      titleElement.textContent = title || "";
    }
    if (messageElement) {
      messageElement.textContent = message || "";
    }
    modalController.open();
  }

  function configurePromptUI({ label, placeholder, value }) {
    mode = "prompt";
    if (inputLabel) {
      inputLabel.hidden = false;
    }
    if (inputLabelText) {
      inputLabelText.textContent = label || "请输入";
    }
    if (input) {
      input.type = "text";
      input.placeholder = placeholder || "";
      input.value = value || "";
      queueMicrotask(() => {
        input.focus();
        input.select();
      });
    }
  }

  function configureConfirmUI() {
    mode = "confirm";
    if (inputLabel) {
      inputLabel.hidden = true;
    }
    if (input) {
      input.value = "";
    }
  }

  okButton?.addEventListener("click", () => {
    if (mode === "prompt") {
      return;
    }
    modalController.close();
    settle(true);
  });

  cancelButton?.addEventListener("click", () => {
    cancel();
  });

  closeButton?.addEventListener("click", () => {
    cancel();
  });

  modal?.addEventListener("click", (event) => {
    if (event.target === modal && modal.classList.contains("open")) {
      cancel();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal?.classList.contains("open")) {
      cancel();
    }
  });

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!modal?.classList.contains("open")) {
      return;
    }
    if (mode === "prompt") {
      const value = input ? input.value : "";
      modalController.close();
      settle(value);
    } else {
      modalController.close();
      settle(true);
    }
  });

  async function confirm(options = {}) {
    if (pendingResolve) {
      cancel();
    }
    const { title = t?.("dialog.confirm") || "确认", message = "", okText = t?.("common.ok") || "确定", cancelText = t?.("common.cancel") || "取消" } =
      options;
    configureConfirmUI();
    if (okButton) {
      okButton.textContent = okText;
      okButton.type = "submit";
    }
    if (cancelButton) {
      cancelButton.textContent = cancelText;
    }

    openBase(title, message);
    return await new Promise((resolve, reject) => {
      pendingResolve = resolve;
      pendingReject = reject;
    });
  }

  async function prompt(options = {}) {
    if (pendingResolve) {
      cancel();
    }
    const {
      title = t?.("dialog.prompt") || "请输入",
      message = "",
      label = t?.("dialog.content") || "内容",
      placeholder = "",
      value = "",
      okText = t?.("common.ok") || "确定",
      cancelText = t?.("common.cancel") || "取消"
    } = options;

    configurePromptUI({ label, placeholder, value });
    if (okButton) {
      okButton.textContent = okText;
      okButton.type = "submit";
    }
    if (cancelButton) {
      cancelButton.textContent = cancelText;
    }

    openBase(title, message);
    return await new Promise((resolve, reject) => {
      pendingResolve = resolve;
      pendingReject = reject;
    });
  }

  return { confirm, prompt };
}
