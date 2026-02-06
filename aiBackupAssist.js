import { loadSettings, loadAccounts, loadActiveAccountId } from "./src/storage.js";
import { WebDavClient } from "./src/webdavClient.js";
import { normalizePath, formatSize } from "./src/utils.js";

const siteText = document.getElementById("siteText");
const nameText = document.getElementById("nameText");
const fileInput = document.getElementById("fileInput");
const uploadBtn = document.getElementById("uploadBtn");
const abortBtn = document.getElementById("abortBtn");
const closeBtn = document.getElementById("closeBtn");
const bar = document.getElementById("bar");
const progressText = document.getElementById("progressText");
const totalText = document.getElementById("totalText");
const loadedText = document.getElementById("loadedText");
const speedText = document.getElementById("speedText");
const status = document.getElementById("status");

const params = new URLSearchParams(location.search);
const site = String(params.get("site") || "").toLowerCase();
const originalName = String(params.get("name") || "");

function sanitizeFilename(name) {
  return String(name || "file")
    .replace(/[\\\/:*?"<>|\u0000-\u001F]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

function buildAiBackupPath(siteKey, filename) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const stamp = now
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .replace("Z", "");
  const safe = sanitizeFilename(filename);
  return {
    dir: `/AI-Backups/${siteKey}/${date}/`,
    path: `/AI-Backups/${siteKey}/${date}/${stamp}_${safe}`
  };
}

async function ensureDir(client, path) {
  const parts = String(path || "/")
    .split("/")
    .filter(Boolean);
  let current = "/";
  for (const part of parts) {
    current = `${current}${part}/`;
    try {
      await client.mkcol(current);
    } catch (error) {
      const status = error?.status || 0;
      if (status === 405 || status === 409) {
        continue;
      }
      throw error;
    }
  }
}

async function createClientFromActiveAccount() {
  const settings = await loadSettings();
  const accounts = await loadAccounts();
  const activeId = await loadActiveAccountId();
  const active = accounts.find((a) => a.id === activeId) || {};
  const config = {
    concurrency: 2,
    cacheLimitMb: 200,
    autoSync: false,
    syncIntervalMinutes: 30,
    ...settings,
    ...active
  };
  return new WebDavClient(config);
}

let activeTask = null;
let lastLoaded = 0;
let lastTs = 0;
let speedBps = 0;

function setProgress(percent) {
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
  bar.style.width = `${clamped}%`;
  progressText.textContent = clamped ? `上传中... ${Math.round(clamped)}%` : "";
}

function setStatus(text) {
  status.textContent = String(text || "");
}

function resetUi() {
  setProgress(0);
  totalText.textContent = "";
  loadedText.textContent = "";
  speedText.textContent = "";
  abortBtn.disabled = true;
  uploadBtn.disabled = !fileInput.files?.[0];
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) {
    resetUi();
    return;
  }
  totalText.textContent = formatSize(file.size || 0);
  loadedText.textContent = formatSize(0);
  speedText.textContent = "-";
  uploadBtn.disabled = false;
});

abortBtn.addEventListener("click", () => {
  if (activeTask?.abort) {
    activeTask.abort();
    setStatus("已终止上传");
  }
});

closeBtn.addEventListener("click", () => {
  window.close();
});

uploadBtn.addEventListener("click", async () => {
  const file = fileInput.files?.[0];
  if (!file) {
    return;
  }
  if (!site) {
    setStatus("缺少站点参数");
    return;
  }
  if (activeTask?.abort) {
    try {
      activeTask.abort();
    } catch {}
  }
  resetUi();
  setStatus("准备上传...");
  uploadBtn.disabled = true;
  try {
    const client = await createClientFromActiveAccount();
    if (!client.endpoint) {
      setStatus("未配置 WebDAV 账号，请先在扩展里配置并连接。");
      uploadBtn.disabled = false;
      return;
    }
    const target = buildAiBackupPath(site, file.name || originalName || "file");
    await ensureDir(client, normalizePath(target.dir));
    lastLoaded = 0;
    lastTs = performance.now();
    speedBps = 0;
    abortBtn.disabled = false;
    activeTask = client.createPutTask(target.path, file, {
      onProgress: ({ loaded, total, percent }) => {
        const now = performance.now();
        const deltaBytes = Math.max(0, Number(loaded || 0) - lastLoaded);
        const deltaSec = Math.max(0, (now - lastTs) / 1000);
        const instant = deltaSec > 0 ? deltaBytes / deltaSec : 0;
        speedBps = speedBps ? speedBps * 0.75 + instant * 0.25 : instant;
        lastLoaded = Number(loaded || 0) || 0;
        lastTs = now;
        setProgress(percent);
        loadedText.textContent = formatSize(lastLoaded);
        speedText.textContent = speedBps ? `${formatSize(speedBps)}/s` : "-";
      }
    });
    await activeTask.promise;
    setProgress(100);
    setStatus(`上传完成：${target.path}`);
  } catch (error) {
    setStatus(`上传失败：${error?.status ? `${error.status} ` : ""}${error?.message || String(error)}`);
  } finally {
    abortBtn.disabled = true;
    uploadBtn.disabled = false;
    activeTask = null;
  }
});

siteText.textContent = site || "-";
nameText.textContent = originalName || "-";
resetUi();

