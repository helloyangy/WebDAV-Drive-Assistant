const SETTINGS_KEY = "webdav_settings";
const ACCOUNTS_KEY = "webdav_accounts";
const ACTIVE_ACCOUNT_KEY = "webdav_active_account";
const VIEW_MODE_KEY = "webdav_view_mode";
const AI_BACKUP_KEY = "webdav_ai_backup_settings";

export async function loadSettings() {
  const { [SETTINGS_KEY]: settings } = await chrome.storage.sync.get(SETTINGS_KEY);
  return {
    concurrency: 2,
    cacheLimitMb: 200,
    autoSync: false,
    syncIntervalMinutes: 30,
    openMode: "tab",
    sortBy: "name",
    sortOrder: "asc",
    hideDotfiles: false,
    language: "zh-CN",
    logLevel: "warn",
    ...(settings || {})
  };
}

export async function saveSettings(settings) {
  await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
}

export function subscribeSettings(callback) {
  const listener = (changes, area) => {
    if (area !== "sync") {
      return;
    }
    if (changes[SETTINGS_KEY]) {
      callback(changes[SETTINGS_KEY].newValue);
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export async function loadAccounts() {
  const { [ACCOUNTS_KEY]: accounts } = await chrome.storage.sync.get(ACCOUNTS_KEY);
  return accounts || [];
}

export async function saveAccounts(accounts) {
  await chrome.storage.sync.set({ [ACCOUNTS_KEY]: accounts });
}

export async function loadActiveAccountId() {
  const { [ACTIVE_ACCOUNT_KEY]: activeId } = await chrome.storage.sync.get(ACTIVE_ACCOUNT_KEY);
  return activeId || "";
}

export async function saveActiveAccountId(activeId) {
  await chrome.storage.sync.set({ [ACTIVE_ACCOUNT_KEY]: activeId });
}

export async function loadViewMode() {
  const { [VIEW_MODE_KEY]: mode } = await chrome.storage.sync.get(VIEW_MODE_KEY);
  return mode === "grid" ? "grid" : "list";
}

export async function saveViewMode(mode) {
  await chrome.storage.sync.set({ [VIEW_MODE_KEY]: mode === "grid" ? "grid" : "list" });
}

export function subscribeAccounts(callback) {
  const listener = (changes, area) => {
    if (area !== "sync") {
      return;
    }
    if (changes[ACCOUNTS_KEY]) {
      callback(changes[ACCOUNTS_KEY].newValue || []);
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export function subscribeActiveAccount(callback) {
  const listener = (changes, area) => {
    if (area !== "sync") {
      return;
    }
    if (changes[ACTIVE_ACCOUNT_KEY]) {
      callback(changes[ACTIVE_ACCOUNT_KEY].newValue || "");
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export async function loadAiBackupSettings() {
  const { [AI_BACKUP_KEY]: settings } = await chrome.storage.sync.get(AI_BACKUP_KEY);
  const base = settings || {};
  const mode = base.mode === "auto" || base.mode === "ask" ? base.mode : "off";
  const blockedExtensions = Array.isArray(base.blockedExtensions) ? base.blockedExtensions : [];
  const blockedSites = Array.isArray(base.blockedSites) ? base.blockedSites : [];
  const backupAccountId = typeof base.backupAccountId === "string" ? base.backupAccountId : "";
  return {
    mode,
    blockedExtensions: blockedExtensions.map((v) => String(v || "").trim().toLowerCase()).filter(Boolean),
    blockedSites: blockedSites.map((v) => String(v || "").trim().toLowerCase()).filter(Boolean),
    backupAccountId: backupAccountId.trim()
  };
}

export async function saveAiBackupSettings(settings) {
  await chrome.storage.sync.set({ [AI_BACKUP_KEY]: settings });
}

export function subscribeAiBackupSettings(callback) {
  const listener = (changes, area) => {
    if (area !== "sync") {
      return;
    }
    if (changes[AI_BACKUP_KEY]) {
      callback(changes[AI_BACKUP_KEY].newValue);
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
