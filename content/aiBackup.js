(() => {
  const AI_BACKUP_KEY = "webdav_ai_backup_settings";
  const CHUNK_SIZE = 1024 * 1024;
  const PROMPT_ID = "webdav-ai-backup-prompt";
  const TOAST_ID = "webdav-ai-backup-toast";

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
    if (host === "x.ai" || host.endsWith(".x.ai") || host === "x.com") return "grok";
    if (host === "doubao.com" || host.endsWith(".doubao.com") || host === "www.doubao.com") return "doubao";
    if (host === "yuanbao.tencent.com" || host.endsWith(".yuanbao.tencent.com")) return "yuanbao";
    if (host === "qianwen.aliyun.com" || host === "tongyi.aliyun.com") return "qianwen";
    return "";
  }

  function getFileExtension(name) {
    const lower = String(name || "").toLowerCase();
    const idx = lower.lastIndexOf(".");
    if (idx <= 0) return "";
    return lower.slice(idx + 1);
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
    if (file?.size && file.size <= 8 * 1024 * 1024) {
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
      await chrome.runtime.sendMessage({ type: "openAiBackupAssist", site: siteKey, fileName: file?.name || "" });
      return { ok: false, error: "manual_required" };
    } catch (error) {
      return { ok: false, error: error?.message || String(error) };
    }
    const port = chrome.runtime.connect({ name: "aiBackupUpload" });
    let ready = false;
    let finished = false;
    let resultResolved = false;
    let lastProgress = 0;

    const wait = new Promise((resolve) => {
      function finish(value) {
        if (resultResolved) return;
        resultResolved = true;
        resolve(value);
      }
      port.onMessage.addListener((msg) => {
        const type = String(msg?.type || "");
        if (type === "skipped") {
          finished = true;
          finish({ ok: true, skipped: true });
          try {
            port.disconnect();
          } catch {}
          return;
        }
        if (type === "ready") {
          ready = true;
          return;
        }
        if (type === "progress") {
          const percent = Number(msg?.percent || 0) || 0;
          if (percent >= lastProgress + 25 || percent === 100) {
            lastProgress = percent;
            showToast(`AI 备份进度：${file?.name || ""} ${Math.round(percent)}%`, 1200);
          }
          return;
        }
        if (type === "done") {
          finished = true;
          finish({ ok: true, skipped: false, path: msg?.path || "" });
          try {
            port.disconnect();
          } catch {}
          return;
        }
        if (type === "aborted") {
          finished = true;
          finish({ ok: false, aborted: true });
          try {
            port.disconnect();
          } catch {}
          return;
        }
        if (type === "error") {
          finished = true;
          const status = Number(msg?.status || 0) || 0;
          const message = String(msg?.message || "error");
          finish({ ok: false, status, error: message });
          try {
            port.disconnect();
          } catch {}
          return;
        }
      });
      port.onDisconnect.addListener(() => {
        if (!finished) {
          finished = true;
          finish({ ok: false, error: "Port disconnected" });
        }
      });
    });

    port.postMessage({
      type: "start",
      site: siteKey,
      fileName: file?.name || "file",
      size: file?.size || 0,
      mime: file?.type || "",
      pageUrl: location.href
    });

    const start = performance.now();
    while (!ready && !finished && performance.now() - start < 10_000) {
      await new Promise((r) => setTimeout(r, 50));
    }
    if (!ready || finished) {
      if (!finished) {
        try {
          port.postMessage({ type: "abort" });
        } catch {}
      }
      return await wait;
    }

    showToast(`AI 备份：开始上传 ${file?.name || ""}`, 1400);
    const size = Number(file?.size || 0) || 0;
    for (let offset = 0; offset < size; offset += CHUNK_SIZE) {
      if (finished) break;
      const slice = file.slice(offset, Math.min(size, offset + CHUNK_SIZE));
      const buffer = await slice.arrayBuffer();
      port.postMessage({ type: "chunk", buffer });
    }
    port.postMessage({ type: "end" });
    return await wait;
  }

  async function handleFiles(files) {
    const list = Array.from(files || []).filter((f) => f instanceof File);
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

