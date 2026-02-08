(() => {
  const FLAG = "__webdavAiBackupMainHookInstalled";
  if (globalThis[FLAG]) return;
  globalThis[FLAG] = true;

  const seen = new WeakSet();

  function isFileLike(value) {
    return value && typeof value === "object" && typeof value.name === "string" && typeof value.size === "number" && typeof value.slice === "function";
  }

  function isBlobLike(value) {
    return value && typeof value === "object" && typeof value.size === "number" && typeof value.slice === "function";
  }

  function emit(values, fileName = "") {
    try {
      window.postMessage(
        {
          __webdavAiBackup: true,
          type: "files",
          files: values,
          fileName: String(fileName || "")
        },
        "*"
      );
    } catch {}
  }

  function capture(value, fieldName = "", fileName = "") {
    try {
      if (!value || (typeof value !== "object" && typeof value !== "function")) return;
      if (seen.has(value)) return;
      seen.add(value);
      if (isFileLike(value)) {
        emit([value], value.name);
        return;
      }
      if (isBlobLike(value)) {
        const name = String(fileName || "").trim() || String(fieldName || "").trim() || "";
        emit([value], name);
      }
    } catch {}
  }

  function scanFormData(body) {
    try {
      if (!(body instanceof FormData)) return;
      for (const entry of body.entries()) {
        const key = entry?.[0];
        const value = entry?.[1];
        capture(value, key, "");
      }
    } catch {}
  }

  try {
    const originalAppend = FormData?.prototype?.append;
    if (typeof originalAppend === "function") {
      FormData.prototype.append = function (...args) {
        try {
          capture(args?.[1], args?.[0], args?.[2]);
        } catch {}
        return originalAppend.apply(this, args);
      };
    }
  } catch {}

  try {
    const originalSet = FormData?.prototype?.set;
    if (typeof originalSet === "function") {
      FormData.prototype.set = function (...args) {
        try {
          capture(args?.[1], args?.[0], args?.[2]);
        } catch {}
        return originalSet.apply(this, args);
      };
    }
  } catch {}

  try {
    const originalFetch = globalThis.fetch;
    if (typeof originalFetch === "function") {
      globalThis.fetch = function (...args) {
        try {
          const init = args?.[1];
          const body = init?.body;
          scanFormData(body);
          capture(body, "body", "");
        } catch {}
        return originalFetch.apply(this, args);
      };
    }
  } catch {}

  try {
    const originalSend = XMLHttpRequest?.prototype?.send;
    if (typeof originalSend === "function") {
      XMLHttpRequest.prototype.send = function (...args) {
        try {
          scanFormData(args?.[0]);
          capture(args?.[0], "body", "");
        } catch {}
        return originalSend.apply(this, args);
      };
    }
  } catch {}

  try {
    const originalBeacon = navigator?.sendBeacon;
    if (typeof originalBeacon === "function") {
      navigator.sendBeacon = function (...args) {
        try {
          scanFormData(args?.[1]);
          capture(args?.[1], "body", "");
        } catch {}
        return originalBeacon.apply(this, args);
      };
    }
  } catch {}

  try {
    const originalPicker = globalThis.showOpenFilePicker;
    if (typeof originalPicker === "function") {
      globalThis.showOpenFilePicker = async function (...args) {
        const result = await originalPicker.apply(this, args);
        try {
          const handles = Array.isArray(result) ? result : [];
          for (const handle of handles) {
            try {
              if (handle?.getFile && typeof handle.getFile === "function") {
                handle.getFile().then((file) => capture(file, "picker", "")).catch(() => {});
              }
            } catch {}
          }
        } catch {}
        return result;
      };
    }
  } catch {}

  try {
    const ctor = globalThis.FileSystemFileHandle;
    const originalGetFile = ctor?.prototype?.getFile;
    if (typeof originalGetFile === "function") {
      ctor.prototype.getFile = function (...args) {
        const p = originalGetFile.apply(this, args);
        try {
          Promise.resolve(p)
            .then((file) => capture(file, "handle", ""))
            .catch(() => {});
        } catch {}
        return p;
      };
    }
  } catch {}
})();

