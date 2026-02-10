import { loadSettings, saveSettings } from "./src/storage.js";
import { applyI18n, createI18n, normalizeLanguage } from "./src/i18n.js";
import { setLogLevel } from "./src/logger.js";
import { normalizeIntervalMinutes } from "./src/utils.js";

const form = document.getElementById("settingsForm");
const languageSelect = document.getElementById("languageSelect");
const endpointInput = document.getElementById("endpointInput");
const usernameInput = document.getElementById("usernameInput");
const passwordInput = document.getElementById("passwordInput");
const rootInput = document.getElementById("rootInput");
const concurrencyInput = document.getElementById("concurrencyInput");
const cacheLimitInput = document.getElementById("cacheLimitInput");
const autoSyncInput = document.getElementById("autoSyncInput");
const syncIntervalInput = document.getElementById("syncIntervalInput");
const logLevelSelect = document.getElementById("logLevelSelect");
const savedHint = document.getElementById("savedHint");

let i18n = createI18n("zh-CN");

async function hydrate() {
  const settings = await loadSettings();
  setLogLevel(settings?.logLevel);
  i18n = createI18n(settings.language);
  applyI18n(document, i18n);
  if (languageSelect) {
    languageSelect.value = normalizeLanguage(settings.language);
  }
  endpointInput.value = settings.endpoint || "";
  usernameInput.value = settings.username || "";
  passwordInput.value = settings.password || "";
  rootInput.value = settings.rootPath || "/";
  concurrencyInput.value = settings.concurrency || 2;
  cacheLimitInput.value = settings.cacheLimitMb || 200;
  autoSyncInput.checked = Boolean(settings.autoSync);
  syncIntervalInput.value = normalizeIntervalMinutes(settings.syncIntervalMinutes, 30);
  if (logLevelSelect) {
    logLevelSelect.value = String(settings?.logLevel || "warn");
  }
}

languageSelect?.addEventListener("change", () => {
  const nextLang = normalizeLanguage(languageSelect.value);
  i18n = createI18n(nextLang);
  applyI18n(document, i18n);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const settings = {
    language: normalizeLanguage(languageSelect?.value),
    endpoint: endpointInput.value.trim(),
    username: usernameInput.value.trim(),
    password: passwordInput.value,
    rootPath: rootInput.value.trim() || "/",
    concurrency: Number(concurrencyInput.value || 2),
    cacheLimitMb: Number(cacheLimitInput.value || 200),
    autoSync: autoSyncInput.checked,
    syncIntervalMinutes: normalizeIntervalMinutes(syncIntervalInput.value, 30),
    logLevel: String(logLevelSelect?.value || "warn")
  };
  await saveSettings(settings);
  setLogLevel(settings?.logLevel);
  savedHint.textContent = i18n.t("options.saved");
  setTimeout(() => {
    savedHint.textContent = "";
  }, 1500);
});

hydrate();
