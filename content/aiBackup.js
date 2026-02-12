(() => {
  const AI_BACKUP_KEY = "webdav_ai_backup_settings";
  const CHUNK_SIZE = 1024 * 1024;
  const PROMPT_ID = "webdav-ai-backup-prompt";
  const TOAST_ID = "webdav-ai-backup-toast";

  const recentUploads = new Map();
  const DEDUP_TTL_MS = 5000;

  function makeDeduplicationKey(file) {
    return `${file.name}|${file.size}|${file.lastModified || 0}`;
  }

  function isDuplicate(file) {
    const key = makeDeduplicationKey(file);
    const now = Date.now();
    for (const [k, ts] of recentUploads) {
      if (now - ts > DEDUP_TTL_MS) recentUploads.delete(k);
    }
    if (recentUploads.has(key)) return true;
    recentUploads.set(key, now);
    return false;
  }

  function normalizeSettings(settings) {
    const base = settings || {};
    const mode = base.mode === "auto" || base.mode === "ask" ? base.mode : "off";
    const blockedExtensions = Array.isArray(base.blockedExtensions) ? base.blockedExtensions : [];
    const blockedSites = Array.isArray(base.blockedSites) ? base.blockedSites : [];
    return {
      mode,
      blockedExtensions: blockedExtensions.map((v) => String(v || "").trim().toLowerCase().replace(/^\./, "")).filter(Boolean),
      blockedSites: blockedSites.map((v) => String(v || "").trim().toLowerCase()).filter(Boolean)
    };
  }

  async function loadAiBackupSettings() {
    const result = await chrome.storage.sync.get(AI_BACKUP_KEY);
    return normalizeSettings(result?.[AI_BACKUP_KEY]);
  }

  function resolveSiteKey() {
    const host = String(location.hostname || "").toLowerCase();
    if (host === "chat.openai.com" || host === "chatgpt.com") return "chatgpt";
    if (host === "gemini.google.com") return "gemini";
    if (host === "claude.ai" || host.endsWith(".claude.ai")) return "claude";
    if (host === "x.ai" || host.endsWith(".x.ai") || host === "x.com" || host === "grok.com" || host.endsWith(".grok.com")) return "grok";
    if (host === "doubao.com" || host.endsWith(".doubao.com") || host === "www.doubao.com") return "doubao";
    if (host === "chat.deepseek.com" || host.endsWith(".deepseek.com")) return "deepseek";
    if (host === "kimi.com" || host === "www.kimi.com" || host.endsWith(".kimi.com")) return "kimi";
    if (host === "yuanbao.tencent.com" || host.endsWith(".yuanbao.tencent.com")) return "yuanbao";
    if (
      host === "qianwen.aliyun.com" ||
      host === "tongyi.aliyun.com" ||
      host === "qianwen.com" ||
      host === "www.qianwen.com" ||
      host.endsWith(".qianwen.com") ||
      host === "qwen.ai" ||
      host === "www.qwen.ai" ||
      host.endsWith(".qwen.ai")
    ) {
      return "qianwen";
    }
    return "";
  }

  function getFileExtension(name) {
    const lower = String(name || "").toLowerCase();
    const idx = lower.lastIndexOf(".");
    if (idx <= 0) return "";
    return lower.slice(idx + 1);
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

  function isGenericName(name) {
    const text = String(name || "").trim().toLowerCase();
    if (!text) return true;
    if (text === "file" || text === "body" || text === "blob" || text === "data") return true;
    return false;
  }

  function sanitizeFilename(name) {
    return String(name || "file")
      .replace(/[\\\/:*?"<>|\u0000-\u001F]/g, "_")
      .replace(/\s+/g, " ")
      .trim();
  }

  function shouldSkipFile(file, settings, siteKey) {
    if (!siteKey) return true;
    if (settings.mode === "off") return true;
    if (settings.blockedSites.includes(siteKey)) return true;
    const ext = getFileExtension(file?.name || "");
    if (ext && settings.blockedExtensions.includes(ext)) return true;
    return false;
  }

  function removePrompt() {
    const existing = document.getElementById(PROMPT_ID);
    existing?.remove?.();
  }

  function showToast(message, durationMs = 2400) {
    const text = String(message || "").trim();
    if (!text) return;
    const existing = document.getElementById(TOAST_ID);
    existing?.remove?.();
    const host = document.createElement("div");
    host.id = TOAST_ID;
    host.style.position = "fixed";
    host.style.right = "16px";
    host.style.bottom = "16px";
    host.style.zIndex = "2147483647";
    host.style.fontFamily = "system-ui, -apple-system, Segoe UI, Arial, sans-serif";
    host.style.maxWidth = "360px";
    host.style.borderRadius = "12px";
    host.style.border = "1px solid rgba(0,0,0,0.12)";
    host.style.background = "rgba(17,24,39,0.92)";
    host.style.boxShadow = "0 10px 30px rgba(0,0,0,0.18)";
    host.style.padding = "10px 12px";
    host.style.color = "#fff";
    host.style.fontSize = "12px";
    host.style.lineHeight = "1.4";
    host.style.wordBreak = "break-word";
    host.textContent = text;
    document.documentElement.appendChild(host);
    setTimeout(() => {
      host.remove?.();
    }, Number(durationMs) || 2400);
  }

  function showPrompt(fileName, onYes, onNo) {
    removePrompt();
    const host = document.createElement("div");
    host.id = PROMPT_ID;
    host.style.position = "fixed";
    host.style.right = "16px";
    host.style.bottom = "16px";
    host.style.zIndex = "2147483647";
    host.style.fontFamily = "system-ui, -apple-system, Segoe UI, Arial, sans-serif";
    host.style.width = "320px";
    host.style.borderRadius = "12px";
    host.style.border = "1px solid rgba(0,0,0,0.12)";
    host.style.background = "rgba(255,255,255,0.98)";
    host.style.boxShadow = "0 10px 30px rgba(0,0,0,0.18)";
    host.style.padding = "12px";
    host.style.color = "#111";

    const title = document.createElement("div");
    title.textContent = "是否备份该文件到网盘？";
    title.style.fontSize = "13px";
    title.style.fontWeight = "600";
    title.style.marginBottom = "6px";

    const detail = document.createElement("div");
    detail.textContent = String(fileName || "");
    detail.style.fontSize = "12px";
    detail.style.color = "rgba(17,24,39,0.72)";
    detail.style.wordBreak = "break-word";
    detail.style.marginBottom = "10px";

    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "8px";
    row.style.justifyContent = "flex-end";

    const noBtn = document.createElement("button");
    noBtn.textContent = "不备份";
    noBtn.type = "button";
    noBtn.style.padding = "7px 10px";
    noBtn.style.borderRadius = "10px";
    noBtn.style.border = "1px solid rgba(15,23,42,0.16)";
    noBtn.style.background = "rgba(255,255,255,0.9)";
    noBtn.style.cursor = "pointer";
    noBtn.onclick = () => {
      removePrompt();
      try {
        onNo?.();
      } catch {}
    };

    const yesBtn = document.createElement("button");
    yesBtn.textContent = "备份";
    yesBtn.type = "button";
    yesBtn.style.padding = "7px 10px";
    yesBtn.style.borderRadius = "10px";
    yesBtn.style.border = "1px solid rgba(17,24,39,0.2)";
    yesBtn.style.background = "#111827";
    yesBtn.style.color = "#fff";
    yesBtn.style.cursor = "pointer";
    yesBtn.onclick = () => {
      removePrompt();
      try {
        onYes?.();
      } catch {}
    };

    row.appendChild(noBtn);
    row.appendChild(yesBtn);
    host.appendChild(title);
    host.appendChild(detail);
    host.appendChild(row);
    document.documentElement.appendChild(host);
  }

  async function uploadToWebDav(file, siteKey) {
    const size = Number(file?.size || 0) || 0;
    if (size <= 8 * 1024 * 1024) {
      try {
        showToast(`AI 备份：开始上传 ${file?.name || ""}`, 1400);
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error("FileReader error"));
          reader.onload = () => resolve(String(reader.result || ""));
          reader.readAsDataURL(file);
        });
        const response = await chrome.runtime.sendMessage({
          type: "aiBackupUploadBase64",
          site: siteKey,
          fileName: file?.name || "file",
          dataUrl
        });
        if (response?.ok && response?.skipped) return { ok: true, skipped: true };
        if (response?.ok) return { ok: true, skipped: false, path: response?.path || "" };
        return { ok: false, status: response?.status || 0, error: response?.error || "error" };
      } catch (error) {
        return { ok: false, error: error?.message || String(error) };
      }
    }
    try {
      await chrome.runtime.sendMessage({
        type: "openAiBackupAssist",
        site: siteKey,
        fileName: file?.name || "",
        size: file?.size || 0
      });
      return { ok: false, error: "manual_required" };
    } catch (error) {
      return { ok: false, error: error?.message || String(error) };
    }
  }

  async function handleFiles(files) {
    const list = Array.from(files || []).filter(
      (f) =>
        f &&
        typeof f === "object" &&
        typeof f.name === "string" &&
        typeof f.size === "number" &&
        typeof f.slice === "function"
    );
    if (!list.length) return;
    const siteKey = resolveSiteKey();
    const settings = await loadAiBackupSettings();
    if (!siteKey) {
      showToast("AI 备份：当前网站未在支持列表");
      return;
    }
    if (settings.mode === "off") {
      showToast("AI 备份：未启用（当前为禁止备份）");
      return;
    }
    if (settings.blockedSites.includes(siteKey)) {
      showToast("AI 备份：该网站已被禁止备份");
      return;
    }
    for (const file of list) {
      if (shouldSkipFile(file, settings, siteKey)) {
        showToast(`AI 备份：已跳过 ${file.name}`);
        continue;
      }
      if (isDuplicate(file)) continue;
      if (settings.mode === "ask") {
        await new Promise((resolve) => {
          showPrompt(file.name, async () => {
            try {
              const result = await uploadToWebDav(file, siteKey);
              if (result?.ok && result?.skipped) {
                showToast(`AI 备份：已跳过 ${file.name}`);
              } else if (result?.ok) {
                showToast(`AI 备份：已备份 ${file.name}`);
              } else if (result?.aborted) {
                showToast(`AI 备份：已取消 ${file.name}`);
              } else if (result?.error === "manual_required") {
                showToast(`AI 备份提示：大文件上传请使用弹窗`, 5200);
              } else {
                const detail = result?.status ? `（${result.status}）` : "";
                const msg = result?.error ? `：${result.error}` : "：no response";
                showToast(`AI 备份失败：${file.name}${detail}${msg}`, 5200);
              }
            } catch (error) {
              showToast(`AI 备份失败：${file.name}：${error?.message || String(error)}`, 5200);
            }
            resolve();
          }, () => resolve());
        });
        continue;
      }
      if (settings.mode === "auto") {
        showToast(`AI 备份开始：${file.name}`, 1400);
        uploadToWebDav(file, siteKey)
          .then((result) => {
            if (result?.ok && !result?.skipped) {
              showToast(`AI 备份完成：${file.name}`);
              return;
            }
            if (result?.ok && result?.skipped) {
              showToast(`AI 备份：已跳过 ${file.name}`);
              return;
            }
            if (result?.aborted) {
              showToast(`AI 备份：已取消 ${file.name}`);
              return;
            }
            if (result?.error === "manual_required") {
              showToast(`AI 备份提示：大文件上传请使用弹窗`, 5200);
              return;
            }
            const detail = result?.status ? `（${result.status}）` : "";
            const msg = result?.error ? `：${result.error}` : "：no response";
            showToast(`AI 备份失败：${file.name}${detail}${msg}`, 5200);
          })
          .catch((error) => {
            showToast(`AI 备份失败：${file.name}：${error?.message || String(error)}`, 5200);
          });
      }
    }
  }

  (() => {
    const INJECT_ID = "__webdav-ai-backup-main-hook";
    try {
      if (!document.getElementById(INJECT_ID)) {
        const script = document.createElement("script");
        script.id = INJECT_ID;
        script.src = chrome.runtime.getURL("content/aiBackupMainHook.js");
        script.async = false;
        (document.head || document.documentElement).appendChild(script);
        script.onload = () => {
          try {
            script.remove();
          } catch {}
        };
      }
    } catch {}

    const seen = new WeakSet();
    window.addEventListener(
      "message",
      (event) => {
        try {
          if (event.source !== window) return;
          const data = event.data;
          if (!data || typeof data !== "object") return;
          if (data.__webdavAiBackup !== true) return;
          if (data.type !== "files") return;
          const files = Array.isArray(data.files) ? data.files : [];
          const next = [];
          for (const value of files) {
            if (!value || (typeof value !== "object" && typeof value !== "function")) continue;
            if (seen.has(value)) continue;
            seen.add(value);
            if (typeof value?.name === "string" && typeof value?.size === "number" && typeof value?.slice === "function") {
              next.push(value);
              continue;
            }
            if (typeof value?.size === "number" && typeof value?.slice === "function" && typeof File === "function") {
              const rawName = decodeFilename(data?.fileName || "");
              let safeName = sanitizeFilename(rawName);
              if (isGenericName(safeName)) {
                safeName = `file_${Date.now()}`;
              }
              next.push(new File([value], safeName, { type: value?.type || "" }));
            }
          }
          if (!next.length) return;
          handleFiles(next).catch(() => {});
        } catch {}
      },
      false
    );
  })();

  document.addEventListener(
    "change",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.type !== "file") return;
      handleFiles(target.files).catch(() => {});
    },
    true
  );
})();


