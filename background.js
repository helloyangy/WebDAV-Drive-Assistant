import { WebDavClient } from "./src/webdavClient.js";
import {
  loadSettings,
  subscribeSettings,
  loadAiBackupSettings,
  subscribeAiBackupSettings,
  loadAccounts,
  loadActiveAccountId,
  subscribeAccounts,
  subscribeActiveAccount
} from "./src/storage.js";
import { getBlob, setBlob, pruneCache, clearCache } from "./src/cache.js";
import { SyncEngine } from "./src/syncEngine.js";
import { ensureWebDavDir } from "./src/utils.js";

let settings = null;
let accounts = [];
let activeAccountId = "";
let client = null;
let sync = null;
let currentConfig = null;
let aiBackupSettings = null;
const aiBackupClientCache = new Map();
let initPromise = null;

function normalizeOpenMode(mode) {
  return mode === "popup" ? "popup" : "tab";
}

async function ensureNoActionPopup() {
  await chrome.action.setPopup({ popup: "" });
}

async function openAppByMode(mode) {
  const url = chrome.runtime.getURL("popup.html");
  const normalized = normalizeOpenMode(mode);
  if (normalized === "popup") {
    await chrome.windows.create({
      url,
      type: "popup",
      width: 980,
      height: 720,
      focused: true
    });
    return;
  }
  await chrome.tabs.create({ url });
}

function resolveActiveAccount() {
  return accounts.find((account) => account.id === activeAccountId) || null;
}

function buildConfig() {
  const base = settings || {};
  const active = resolveActiveAccount();
  return {
    concurrency: 2,
    cacheLimitMb: 200,
    autoSync: false,
    syncIntervalMinutes: 30,
    ...base,
    ...(active || {})
  };
}

function buildConfigForAccount(account) {
  const base = settings || {};
  return {
    concurrency: 2,
    cacheLimitMb: 200,
    autoSync: false,
    syncIntervalMinutes: 30,
    ...base,
    ...(account || {})
  };
}

function resolveAiBackupAccountId() {
  const preferred = String(aiBackupSettings?.backupAccountId || "").trim();
  if (preferred && accounts.some((a) => a.id === preferred)) {
    return preferred;
  }
  return activeAccountId || "";
}

function getClientForAiBackup(accountId) {
  const normalized = String(accountId || "").trim();
  if (!normalized || normalized === activeAccountId) {
    return client;
  }
  const cached = aiBackupClientCache.get(normalized);
  if (cached) {
    return cached;
  }
  const account = accounts.find((a) => a.id === normalized) || null;
  const cfg = buildConfigForAccount(account);
  const next = new WebDavClient(cfg);
  aiBackupClientCache.set(normalized, next);
  return next;
}

function updateConfig() {
  currentConfig = buildConfig();
  client.updateConfig(currentConfig);
  sync.options.concurrency = currentConfig.concurrency;
  aiBackupClientCache.clear();
}

async function init() {
  if (initPromise) {
    return await initPromise;
  }
  initPromise = Promise.resolve()
    .then(async () => {
      settings = await loadSettings();
      aiBackupSettings = await loadAiBackupSettings();
      accounts = await loadAccounts();
      activeAccountId = await loadActiveAccountId();
      currentConfig = buildConfig();
      client = new WebDavClient(currentConfig);
      sync = new SyncEngine(client, { concurrency: currentConfig.concurrency });
      await ensureNoActionPopup();
      subscribeSettings((next) => {
        settings = next;
        updateConfig();
        ensureNoActionPopup().catch(() => {});
        scheduleAutoSync().catch(() => {});
      });
      subscribeAiBackupSettings((next) => {
        aiBackupSettings = next || null;
      });
      subscribeAccounts((next) => {
        accounts = next;
        updateConfig();
      });
      subscribeActiveAccount((next) => {
        activeAccountId = next;
        updateConfig();
      });
    })
    .catch((error) => {
      initPromise = null;
      throw error;
    });
  return await initPromise;
}

async function ensureInit() {
  await init();
}

chrome.runtime.onInstalled.addListener(() => {
  init().catch(() => {});
});

chrome.action.onClicked.addListener(() => {
  ensureInit()
    .then(async () => {
      await openAppByMode(settings?.openMode);
    })
    .catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  ensureInit()
    .then(async () => {
      if (message.type === "aiBackupUploadBase64") {
        const site = String(message?.site || "").toLowerCase();
        const fileName = String(message?.fileName || "file");
        const dataUrl = String(message?.dataUrl || "");
        const normalized = normalizeAiBackupSettings(aiBackupSettings);
        const ext = getFileExtension(fileName);
        if (normalized.mode === "off" || !site) {
          sendResponse({ ok: true, skipped: true });
          return;
        }
        if (normalized.blockedSites.includes(site)) {
          sendResponse({ ok: true, skipped: true });
          return;
        }
        if (ext && normalized.blockedExtensions.includes(ext)) {
          sendResponse({ ok: true, skipped: true });
          return;
        }
        const m = /^data:([^;]*);base64,(.+)$/i.exec(dataUrl);
        if (!m) {
          throw new Error("Invalid dataUrl");
        }
        const mime = m[1] || "application/octet-stream";
        const b64 = m[2] || "";
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        const accountId = resolveAiBackupAccountId();
        const aiClient = getClientForAiBackup(accountId);
        const target = buildAiBackupPath(site, fileName);
        await ensureWebDavDir(aiClient, target.dir);
        const blob = new Blob([bytes], { type: mime });
        await aiClient.put(target.path, blob);
        sendResponse({ ok: true, skipped: false, path: target.path, size: blob.size });
        return;
      }

      if (message.type === "openAiBackupAssist") {
        const site = String(message?.site || "").toLowerCase();
        const fileName = String(message?.fileName || "");
        const accountId = resolveAiBackupAccountId();
        const url = chrome.runtime.getURL(
          `aiBackupAssist.html?site=${encodeURIComponent(site)}&name=${encodeURIComponent(fileName)}&account=${encodeURIComponent(
            accountId
          )}`
        );
        await chrome.windows.create({
          url,
          type: "popup",
          width: 560,
          height: 620,
          focused: true
        });
        sendResponse({ ok: true });
        return;
      }

      if (message.type === "aiBackupUploadOnce") {
        const site = String(message?.site || "").toLowerCase();
        const fileName = String(message?.fileName || "file");
        const size = Number(message?.size || 0) || 0;
        const mime = String(message?.mime || "") || "application/octet-stream";
        const buffer = message?.buffer;
        const bytes =
          buffer instanceof ArrayBuffer
            ? new Uint8Array(buffer)
            : Array.isArray(buffer)
              ? Uint8Array.from(buffer)
              : buffer?.data && Array.isArray(buffer.data)
                ? Uint8Array.from(buffer.data)
                : buffer?.buffer instanceof ArrayBuffer
                  ? new Uint8Array(buffer.buffer, Number(buffer.byteOffset || 0) || 0, Number(buffer.byteLength || 0) || 0)
                  : null;
        if (!(bytes instanceof Uint8Array) || !bytes.byteLength) {
          throw new Error("Invalid buffer");
        }
        const normalized = normalizeAiBackupSettings(aiBackupSettings);
        const ext = getFileExtension(fileName);
        if (normalized.mode === "off" || !site) {
          sendResponse({ ok: true, skipped: true });
          return;
        }
        if (normalized.blockedSites.includes(site)) {
          sendResponse({ ok: true, skipped: true });
          return;
        }
        if (ext && normalized.blockedExtensions.includes(ext)) {
          sendResponse({ ok: true, skipped: true });
          return;
        }
        const accountId = resolveAiBackupAccountId();
        const aiClient = getClientForAiBackup(accountId);
        const target = buildAiBackupPath(site, fileName);
        await ensureWebDavDir(aiClient, target.dir);
        const blob = new Blob([bytes], { type: mime });
        await aiClient.put(target.path, blob);
        sendResponse({ ok: true, skipped: false, path: target.path, size: size || blob.size });
        return;
      }
      if (message.type === "list") {
        const items = await client.list(message.path);
        sendResponse({ ok: true, items });
        return;
      }
      if (message.type === "download") {
        const blob = await client.get(message.path);
        const buffer = await blob.arrayBuffer();
        const contentType = blob.type || "application/octet-stream";
        try {
          await setBlob(message.path, blob);
        } catch {}
        sendResponse({ ok: true, buffer, contentType });
        return;
      }
      if (message.type === "upload") {
        const blob = message.blob;
        if (!(blob instanceof Blob)) {
          throw new Error("Invalid upload payload");
        }
        await client.put(message.path, blob);
        sendResponse({ ok: true });
        return;
      }
      if (message.type === "delete") {
        if (message?.href && typeof client.deleteByHref === "function") {
          await client.deleteByHref(String(message.href));
        } else {
          await client.delete(message.path);
        }
        sendResponse({ ok: true });
        return;
      }
      if (message.type === "mkdir") {
        await client.mkcol(message.path);
        sendResponse({ ok: true });
        return;
      }
      if (message.type === "move") {
        await client.move(message.source, message.destination);
        sendResponse({ ok: true });
        return;
      }
      if (message.type === "downloadCached") {
        const blob = await getBlob(message.path);
        if (!blob) {
          sendResponse({ ok: false, error: "Cache miss", status: 0, raw: "" });
          return;
        }
        sendResponse({ ok: true, blob });
        return;
      }
      if (message.type === "sync") {
        sync.enqueue({ type: "list", path: message.path });
        sendResponse({ ok: true });
        return;
      }
      if (message.type === "prune") {
        const limitBytes = currentConfig.cacheLimitMb * 1024 * 1024;
        await pruneCache(limitBytes);
        sendResponse({ ok: true });
        return;
      }
      if (message.type === "clearCache") {
        await clearCache();
        sendResponse({ ok: true });
        return;
      }
      const type = typeof message?.type === "string" ? message.type : "";
      sendResponse({ ok: false, error: type ? `Unknown message: ${type}` : "Unknown message" });
    })
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error.message || String(error),
        status: error.status || 0,
        raw: error.raw || ""
      });
    });
  return true;
});

function normalizeAiBackupSettings(settings) {
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

function sanitizeFilename(name) {
  return String(name || "file")
    .replace(/[\\\/:*?"<>|\u0000-\u001F]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

function getFileExtension(name) {
  const lower = String(name || "").toLowerCase();
  const idx = lower.lastIndexOf(".");
  if (idx <= 0) {
    return "";
  }
  return lower.slice(idx + 1);
}

function buildAiBackupPath(site, filename) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const stamp = now
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .replace("Z", "");
  const safe = sanitizeFilename(filename);
  return {
    dir: `/AI-Backups/${site}/${date}/`,
    path: `/AI-Backups/${site}/${date}/${stamp}_${safe}`
  };
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "aiBackupUpload") {
    return;
  }
  const MAX_BUFFER_BYTES = 50 * 1024 * 1024;
  let uploadStarted = false;
  let uploadEnded = false;
  let skipped = false;
  let bytesReceived = 0;
  let totalBytes = 0;
  let targetPath = "";
  let mime = "";
  let chunks = [];
  let uploadTask = null;
  let closing = false;
  let aiClient = null;

  function closePort() {
    closing = true;
    try {
      port.disconnect();
    } catch {}
  }

  function toUint8Array(payload) {
    if (payload instanceof ArrayBuffer) {
      return new Uint8Array(payload);
    }
    if (payload instanceof Uint8Array) {
      return payload;
    }
    const buffer = payload?.buffer;
    if (buffer instanceof ArrayBuffer) {
      const offset = Number(payload.byteOffset || 0) || 0;
      const length = Number(payload.byteLength || 0) || 0;
      return new Uint8Array(buffer, offset, length || buffer.byteLength);
    }
    const data = payload?.data;
    if (Array.isArray(data)) {
      return Uint8Array.from(data);
    }
    return null;
  }

  function abortUpload(notify = true) {
    if (uploadTask?.abort && typeof uploadTask.abort === "function") {
      try {
        uploadTask.abort();
      } catch {}
    }
    uploadTask = null;
    chunks = [];
    uploadEnded = true;
    if (notify) {
      try {
        port.postMessage({ type: "aborted" });
      } catch {}
    }
    closePort();
  }

  port.onDisconnect.addListener(() => {
    if (closing) {
      return;
    }
    abortUpload(false);
  });

  port.onMessage.addListener((message) => {
    ensureInit()
      .then(async () => {
        const type = String(message?.type || "");
        if (type === "start") {
          if (uploadStarted) {
            return;
          }
          uploadStarted = true;
          const site = String(message?.site || "").toLowerCase();
          const fileName = String(message?.fileName || "file");
          totalBytes = Number(message?.size || 0) || 0;
          mime = String(message?.mime || "") || "application/octet-stream";
          const normalized = normalizeAiBackupSettings(aiBackupSettings);
          const ext = getFileExtension(fileName);
          if (normalized.mode === "off" || !site) {
            skipped = true;
            port.postMessage({ type: "skipped" });
            closePort();
            return;
          }
          if (normalized.blockedSites.includes(site)) {
            skipped = true;
            port.postMessage({ type: "skipped" });
            closePort();
            return;
          }
          if (ext && normalized.blockedExtensions.includes(ext)) {
            skipped = true;
            port.postMessage({ type: "skipped" });
            closePort();
            return;
          }

          const accountId = resolveAiBackupAccountId();
          aiClient = getClientForAiBackup(accountId);
          const target = buildAiBackupPath(site, fileName);
          await ensureWebDavDir(aiClient, target.dir);
          port.postMessage({ type: "ready", path: target.path });
          targetPath = target.path;
          return;
        }

        if (type === "chunk") {
          if (skipped || !uploadStarted || uploadEnded) {
            return;
          }
          const chunk = toUint8Array(message?.buffer);
          if (!chunk) {
            return;
          }
          bytesReceived += chunk.byteLength;
          if (bytesReceived > MAX_BUFFER_BYTES) {
            uploadEnded = true;
            port.postMessage({ type: "error", message: "File too large for AI backup buffer", status: 0, raw: "" });
            closePort();
            return;
          }
          chunks.push(chunk);
          if (totalBytes) {
            const percent = Math.min(100, Math.round((bytesReceived / totalBytes) * 100));
            if (percent % 10 === 0) {
              port.postMessage({ type: "progress", loaded: bytesReceived, total: totalBytes, percent });
            }
          }
          return;
        }

        if (type === "end") {
          if (skipped) {
            return;
          }
          if (uploadEnded) {
            return;
          }
          uploadEnded = true;
          if (!targetPath) {
            port.postMessage({ type: "error", message: "Missing target path", status: 0, raw: "" });
            closePort();
            return;
          }
          if (totalBytes && bytesReceived === 0) {
            port.postMessage({ type: "error", message: "No file data received", status: 0, raw: "" });
            closePort();
            return;
          }
          const blob = new Blob(chunks, { type: mime || "application/octet-stream" });
          chunks = [];
          Promise.resolve()
            .then(async () => {
              const targetClient = aiClient || client;
              await targetClient.put(targetPath, blob);
              port.postMessage({ type: "progress", loaded: totalBytes || blob.size || bytesReceived, total: totalBytes || blob.size || bytesReceived, percent: 100 });
            })
            .then(() => {
              port.postMessage({ type: "done", path: targetPath, size: totalBytes || blob.size || bytesReceived });
              closePort();
            })
            .catch((error) => {
              if (error?.code === "aborted") {
                port.postMessage({ type: "aborted" });
                closePort();
                return;
              }
              port.postMessage({
                type: "error",
                message: error?.message || String(error),
                status: error?.status || 0,
                raw: error?.raw || ""
              });
              closePort();
            });
          return;
        }

        if (type === "abort") {
          abortUpload();
          return;
        }
      })
      .catch((error) => {
        port.postMessage({
          type: "error",
          message: error?.message || String(error),
          status: error?.status || 0,
          raw: error?.raw || ""
        });
        closePort();
      });
  });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "autoSync") {
    await ensureInit();
    sync.enqueue({ type: "refresh" });
  }
});

async function scheduleAutoSync() {
  await ensureInit();
  if (!currentConfig.autoSync) {
    chrome.alarms.clear("autoSync");
    return;
  }
  chrome.alarms.create("autoSync", {
    periodInMinutes: currentConfig.syncIntervalMinutes || 30
  });
}

scheduleAutoSync();
