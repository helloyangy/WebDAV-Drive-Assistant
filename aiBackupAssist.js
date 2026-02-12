import { loadSettings, loadAccounts, loadActiveAccountId } from "./src/storage.js";
import { WebDavClient } from "./src/webdavClient.js";
import { normalizePath, formatSize, ensureWebDavDir } from "./src/utils.js";

const siteText = document.getElementById("siteText");
const nameText = document.getElementById("nameText");
const fileInput = document.getElementById("fileInput");
const uploadBtn = document.getElementById("uploadBtn");
const abortBtn = document.getElementById("abortBtn");
const bar = document.getElementById("bar");
const progressArea = document.getElementById("progressArea");
const progressText = document.getElementById("progressText");
const speedText = document.getElementById("speedText");
const status = document.getElementById("status");
const filePicker = document.getElementById("filePicker");
const filePickerText = document.getElementById("filePickerText");

const params = new URLSearchParams(location.search);
const site = String(params.get("site") || "").toLowerCase();
const originalName = String(params.get("name") || "");
const preferredAccountId = String(params.get("account") || "");

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

async function createClientFromAccountId(accountId) {
  const settings = await loadSettings();
  const accounts = await loadAccounts();
  const activeId = await loadActiveAccountId();
  const normalized = String(accountId || "").trim();
  const picked = normalized && accounts.some((a) => a.id === normalized) ? normalized : activeId;
  const active = accounts.find((a) => a.id === picked) || {};
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
  progressText.textContent = clamped ? `${Math.round(clamped)}%` : "";
}

function setStatus(text) {
  status.textContent = String(text || "");
}

function resetUi() {
  setProgress(0);
  speedText.textContent = "";
  progressArea.hidden = true;
  abortBtn.disabled = true;
  abortBtn.hidden = true;
  uploadBtn.disabled = !fileInput.files?.[0];
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) {
    filePickerText.textContent = "点击选择文件";
    filePicker.classList.remove("has-file");
    resetUi();
    return;
  }
  filePickerText.textContent = file.name;
  filePicker.classList.add("has-file");
  uploadBtn.disabled = false;
});

abortBtn.addEventListener("click", () => {
  if (activeTask?.abort) {
    activeTask.abort();
    setStatus("已终止上传");
  }
});

uploadBtn.addEventListener("click", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  if (!site) {
    setStatus("缺少站点参数");
    return;
  }
  if (activeTask?.abort) {
    try { activeTask.abort(); } catch {}
  }
  resetUi();
  progressArea.hidden = false;
  setStatus("准备上传...");
  uploadBtn.disabled = true;
  try {
    const client = await createClientFromAccountId(preferredAccountId);
    if (!client.endpoint) {
      setStatus("未配置 WebDAV 账号，请先在扩展里配置并连接。");
      uploadBtn.disabled = false;
      return;
    }
    const target = buildAiBackupPath(site, file.name || originalName || "file");
    await ensureWebDavDir(client, normalizePath(target.dir));
    lastLoaded = 0;
    lastTs = performance.now();
    speedBps = 0;
    abortBtn.disabled = false;
    abortBtn.hidden = false;
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
        speedText.textContent = speedBps ? `${formatSize(speedBps)}/s` : "";
      }
    });
    await activeTask.promise;
    setProgress(100);
    setStatus("上传完成");
  } catch (error) {
    setStatus(`上传失败：${error?.status ? `${error.status} ` : ""}${error?.message || String(error)}`);
  } finally {
    abortBtn.disabled = true;
    abortBtn.hidden = true;
    uploadBtn.disabled = false;
    activeTask = null;
  }
});

siteText.textContent = site || "-";
nameText.textContent = originalName || "-";
resetUi();
