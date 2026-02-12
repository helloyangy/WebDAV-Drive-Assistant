(() => {
  const FLAG = "__webdavAiBackupMainHookInstalled";
  if (globalThis[FLAG]) return;
  globalThis[FLAG] = true;

  const seen = new WeakSet();
  const recentNameBySignature = new Map();
  const recentNameByRequestKey = new Map();
  const SIGNATURE_TTL_MS = 30000;
  const REQUEST_TTL_MS = 10 * 60 * 1000;
  const blobNameMap = new WeakMap();

  function isFileLike(value) {
    return value && typeof value === "object" && typeof value.name === "string" && typeof value.size === "number" && typeof value.slice === "function";
  }

  function isBlobLike(value) {
    return value && typeof value === "object" && typeof value.size === "number" && typeof value.slice === "function";
  }

  function isGenericName(name) {
    const text = String(name || "").trim().toLowerCase();
    if (!text) return true;
    if (text === "file" || text === "body" || text === "blob" || text === "data") return true;
    return false;
  }

  function setBlobName(value, name) {
    try {
      const text = String(name || "").trim();
      if (!text || isGenericName(text)) return;
      if (value && typeof value === "object") {
        blobNameMap.set(value, text);
        if (!value.__webdavFileName) {
          try {
            Object.defineProperty(value, "__webdavFileName", { value: text, configurable: true });
          } catch {
            try {
              value.__webdavFileName = text;
            } catch {}
          }
        }
      }
    } catch {}
  }

  function getBlobName(value) {
    try {
      return String(blobNameMap.get(value) || value?.__webdavFileName || "").trim();
    } catch {
      return "";
    }
  }

  function makeSignature(value) {
    try {
      const size = Number(value?.size || 0) || 0;
      const type = String(value?.type || "");
      if (!size && !type) return "";
      return `${size}|${type}`;
    } catch {
      return "";
    }
  }

  function pruneRecent(map, ttlMs, limit, now) {
    try {
      const ts = Number(now) || Date.now();
      for (const [key, item] of map.entries()) {
        if (!item || ts - item.ts > ttlMs) {
          map.delete(key);
        }
      }
      if (map.size <= limit) return;
      const entries = Array.from(map.entries()).sort((a, b) => (a?.[1]?.ts || 0) - (b?.[1]?.ts || 0));
      for (let i = 0; i < entries.length - limit; i += 1) {
        const key = entries[i]?.[0];
        if (key) map.delete(key);
      }
    } catch {}
  }

  function rememberName(value, name) {
    const text = String(name || "").trim();
    if (!text || isGenericName(text)) return;
    const key = makeSignature(value);
    if (!key) return;
    const now = Date.now();
    pruneRecent(recentNameBySignature, SIGNATURE_TTL_MS, 128, now);
    recentNameBySignature.set(key, { name: text, ts: now });
  }

  function recallName(value) {
    const key = makeSignature(value);
    if (!key) return "";
    const now = Date.now();
    pruneRecent(recentNameBySignature, SIGNATURE_TTL_MS, 128, now);
    const item = recentNameBySignature.get(key);
    if (!item || now - item.ts > SIGNATURE_TTL_MS) return "";
    return String(item.name || "").trim();
  }

  function makeRequestKey(url) {
    const raw = String(url || "").trim();
    if (!raw) return "";
    try {
      const u = new URL(raw, location.href);
      const host = String(u.host || "");
      const pathname = String(u.pathname || "");
      const keys = ["upload_id", "uploadId", "uploadid", "session", "session_id", "id", "upload"];
      for (const k of keys) {
        const v = u.searchParams.get(k);
        if (v) return `${host}${pathname}?${k}=${v}`;
      }
      return `${host}${pathname}`;
    } catch {
      return raw.slice(0, 240);
    }
  }

  function rememberRequestName(url, name) {
    const key = makeRequestKey(url);
    const text = String(name || "").trim();
    if (!key || !text || isGenericName(text)) return;
    const now = Date.now();
    pruneRecent(recentNameByRequestKey, REQUEST_TTL_MS, 256, now);
    recentNameByRequestKey.set(key, { name: text, ts: now });
  }

  function recallRequestName(url) {
    const key = makeRequestKey(url);
    if (!key) return "";
    const now = Date.now();
    pruneRecent(recentNameByRequestKey, REQUEST_TTL_MS, 256, now);
    const item = recentNameByRequestKey.get(key);
    if (!item || now - item.ts > REQUEST_TTL_MS) return "";
    return String(item.name || "").trim();
  }

  function normalizeHeaderName(name) {
    return String(name || "").trim().toLowerCase();
  }

  function decodeFilename(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    try {
      return decodeURIComponent(text);
    } catch {
      return text;
    }
  }

  function getHeaderValue(headers, name) {
    const key = normalizeHeaderName(name);
    if (!key || !headers) return "";
    try {
      if (typeof headers.get === "function") {
        return String(headers.get(key) || headers.get(name) || "");
      }
      if (Array.isArray(headers)) {
        for (const pair of headers) {
          const k = normalizeHeaderName(pair?.[0]);
          if (k === key) return String(pair?.[1] || "");
        }
        return "";
      }
      if (typeof headers === "object") {
        for (const [k, v] of Object.entries(headers)) {
          if (normalizeHeaderName(k) === key) return String(v || "");
        }
        return "";
      }
    } catch {}
    return "";
  }

  function parseContentDispositionFilename(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    const star = /filename\*\s*=\s*([^']*)''([^;]+)/i.exec(text);
    if (star) {
      return decodeFilename(star[2]);
    }
    const normal = /filename\s*=\s*"([^"]+)"/i.exec(text) || /filename\s*=\s*([^;]+)/i.exec(text);
    if (normal) {
      return decodeFilename(String(normal[1] || "").trim().replace(/^"|"$/g, ""));
    }
    return "";
  }

  function inferFilenameFromUrl(url) {
    const raw = String(url || "").trim();
    if (!raw) return "";
    try {
      const u = new URL(raw, location.href);
      const fromQuery =
        u.searchParams.get("filename") ||
        u.searchParams.get("fileName") ||
        u.searchParams.get("name") ||
        u.searchParams.get("file") ||
        "";
      if (fromQuery) return decodeFilename(fromQuery);
      const path = decodeFilename(u.pathname || "");
      const last = String(path.split("/").filter(Boolean).pop() || "");
      if (last && last.includes(".") && last.length <= 200) return last;
    } catch {}
    return "";
  }

  function inferFilenameFromRequest(url, headers) {
    const candidates = [];
    candidates.push(decodeFilename(getHeaderValue(headers, "x-goog-upload-file-name")));
    candidates.push(decodeFilename(getHeaderValue(headers, "x-goog-upload-filename")));
    candidates.push(parseContentDispositionFilename(getHeaderValue(headers, "x-goog-upload-header-content-disposition")));
    candidates.push(parseContentDispositionFilename(getHeaderValue(headers, "content-disposition")));
    candidates.push(inferFilenameFromUrl(url));
    for (const item of candidates) {
      const name = String(item || "").trim();
      if (name) return name;
    }
    return "";
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

  try {
    const OriginalBlob = globalThis.Blob;
    if (typeof OriginalBlob === "function") {
      globalThis.Blob = function (...args) {
        const blob = new OriginalBlob(...args);
        try {
          const parts = args?.[0];
          if (Array.isArray(parts)) {
            let picked = "";
            for (const part of parts) {
              if (isFileLike(part)) {
                picked = String(part.name || "").trim();
                if (picked) break;
              }
              const fromMap = getBlobName(part);
              if (fromMap) {
                picked = fromMap;
                break;
              }
            }
            if (picked) {
              setBlobName(blob, picked);
            }
          }
        } catch {}
        return blob;
      };
      globalThis.Blob.prototype = OriginalBlob.prototype;
      globalThis.Blob.prototype.constructor = globalThis.Blob;
      const originalSlice = OriginalBlob?.prototype?.slice;
      if (typeof originalSlice === "function") {
        OriginalBlob.prototype.slice = function (...args) {
          const sliced = originalSlice.apply(this, args);
          try {
            const name = getBlobName(this);
            if (name) setBlobName(sliced, name);
          } catch {}
          return sliced;
        };
      }
    }
  } catch {}

  function capture(value, fieldName = "", fileName = "") {
    try {
      if (!value || (typeof value !== "object" && typeof value !== "function")) return;
      if (seen.has(value)) return;
      seen.add(value);
      if (isFileLike(value)) {
        let name = String(value.name || "").trim();
        if (isGenericName(name)) {
          const remembered = recallName(value);
          if (remembered) {
            name = remembered;
          }
        }
        if (isGenericName(name)) {
          return;
        }
        rememberName(value, name);
        emit([value], name);
        return;
      }
      if (isBlobLike(value)) {
        let name = String(fileName || "").trim() || String(fieldName || "").trim() || "";
        if (isGenericName(name)) {
          const fromMap = getBlobName(value);
          if (fromMap) {
            name = fromMap;
          }
        }
        if (isGenericName(name)) {
          const remembered = recallName(value);
          if (remembered) {
            name = remembered;
          }
        }
        if (isGenericName(name)) {
          return;
        }
        rememberName(value, name);
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
        let url = "";
        let inferred = "";
        try {
          const req = args?.[0];
          const init = args?.[1];
          url = typeof req === "string" ? req : typeof req?.url === "string" ? req.url : "";
          const headers = init?.headers || req?.headers || null;
          const body = init?.body;
          inferred = inferFilenameFromRequest(url, headers);
          const byUrl = recallRequestName(url);
          const finalName = isGenericName(inferred) ? byUrl : inferred;
          if (finalName) {
            rememberRequestName(url, finalName);
          }
          scanFormData(body);
          capture(body, "", finalName);
        } catch {}
        const p = originalFetch.apply(this, args);
        try {
          // No-op: avoid reading non-exposed headers in cross-origin responses.
        } catch {}
        return p;
      };
    }
  } catch {}

  try {
    const originalOpen = XMLHttpRequest?.prototype?.open;
    if (typeof originalOpen === "function") {
      XMLHttpRequest.prototype.open = function (...args) {
        try {
          this.__webdavAiBackupUrl = String(args?.[1] || "");
          this.__webdavAiBackupHeaders = this.__webdavAiBackupHeaders || {};
        } catch {}
        return originalOpen.apply(this, args);
      };
    }
  } catch {}

  try {
    const originalSetHeader = XMLHttpRequest?.prototype?.setRequestHeader;
    if (typeof originalSetHeader === "function") {
      XMLHttpRequest.prototype.setRequestHeader = function (...args) {
        try {
          const name = normalizeHeaderName(args?.[0]);
          const value = String(args?.[1] || "");
          if (name) {
            this.__webdavAiBackupHeaders = this.__webdavAiBackupHeaders || {};
            this.__webdavAiBackupHeaders[name] = value;
          }
        } catch {}
        return originalSetHeader.apply(this, args);
      };
    }
  } catch {}

  try {
    const originalSend = XMLHttpRequest?.prototype?.send;
    if (typeof originalSend === "function") {
      XMLHttpRequest.prototype.send = function (...args) {
        try {
          const body = args?.[0];
          const url = String(this?.__webdavAiBackupUrl || "");
          const headers = this?.__webdavAiBackupHeaders || null;
          const inferred = inferFilenameFromRequest(url, headers);
          const byUrl = recallRequestName(url);
          const finalName = isGenericName(inferred) ? byUrl : inferred;
          if (finalName) {
            rememberRequestName(url, finalName);
          }
          if (!this.__webdavAiBackupRespHooked) {
            this.__webdavAiBackupRespHooked = true;
          }
          scanFormData(body);
          capture(body, "", finalName);
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
          const url = String(args?.[0] || "");
          const body = args?.[1];
          const inferred = inferFilenameFromRequest(url, null);
          const byUrl = recallRequestName(url);
          const finalName = isGenericName(inferred) ? byUrl : inferred;
          if (finalName) {
            rememberRequestName(url, finalName);
          }
          scanFormData(body);
          capture(body, "", finalName);
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

  try {
    const originalClick = HTMLInputElement.prototype.click;
    if (typeof originalClick === "function") {
      HTMLInputElement.prototype.click = function (...args) {
        try {
          if (this.type === "file") {
            this.addEventListener("change", function handler() {
              this.removeEventListener("change", handler);
              const files = Array.from(this.files || []);
              for (const file of files) {
                capture(file, "input", "");
              }
            }, { once: true });
          }
        } catch {}
        return originalClick.apply(this, args);
      };
    }
  } catch {}
})();

