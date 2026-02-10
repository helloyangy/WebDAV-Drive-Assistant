import { formatDate, formatSize, normalizeIntervalMinutes, normalizePath } from "./src/utils.js";
import {
  loadSettings,
  loadAccounts,
  saveAccounts,
  loadActiveAccountId,
  saveActiveAccountId,
  saveSettings,
  loadAiBackupSettings,
  saveAiBackupSettings,
  loadViewMode,
  saveViewMode
} from "./src/storage.js";
import { applyI18n, createI18n, normalizeLanguage } from "./src/i18n.js";
import { sendMessage } from "./src/popup/messaging.js";
import { createErrorFormatter } from "./src/popup/errors.js";
import { createAccountId, getAccountName } from "./src/popup/accountUtils.js";
import { createAccountListController } from "./src/popup/accountList.js";
import { createModalController } from "./src/popup/modal.js";
import { WebDavClient } from "./src/webdavClient.js";
import { createClientFactory } from "./src/popup/clientFactory.js";
import { createStatusController } from "./src/popup/status.js";
import { createDownloadErrorModal } from "./src/popup/downloadErrorModal.js";
import { createPreviewController } from "./src/popup/preview.js";
import { createPathNavigation } from "./src/popup/navigation.js";
import { createContextMenuController } from "./src/popup/contextMenu.js";
import { createFileListController } from "./src/popup/features/fileList/controller.js";
import { createFileOps } from "./src/popup/features/fileOps/index.js";
import { createAccountsController } from "./src/popup/features/accounts/controller.js";
import { createConnectionController } from "./src/popup/features/connection/controller.js";
import { createDialogsController } from "./src/popup/features/dialogs/controller.js";
import { createAiBackupController } from "./src/popup/features/aiBackup/controller.js";
import { createSidebarFooterController } from "./src/popup/features/sidebarFooter/controller.js";
import { setLogLevel, logDebug, logError, logInfo, logWarn } from "./src/logger.js";

const fileList = document.getElementById("fileList");
const pathInput = document.getElementById("pathInput");
const upBtn = document.getElementById("upBtn");
const homeBtn = document.getElementById("homeBtn");
const pathChips = document.getElementById("pathChips");
const refreshBtn = document.getElementById("refreshBtn");
const previewProgressBtn = document.getElementById("previewProgressBtn");
const viewToggleBtn = document.getElementById("viewToggleBtn");
const viewToggleIcon = document.getElementById("viewToggleIcon");
const uploadInput = document.getElementById("uploadInput");
const downloadBtn = document.getElementById("downloadBtn");
const deleteBtn = document.getElementById("deleteBtn");
const mkdirBtn = document.getElementById("mkdirBtn");
const settingsForm = document.getElementById("settingsForm");
const nameInput = document.getElementById("nameInput");
const endpointInput = document.getElementById("endpointInput");
const usernameInput = document.getElementById("usernameInput");
const passwordInput = document.getElementById("passwordInput");
const rootInput = document.getElementById("rootInput");
const concurrencyInput = document.getElementById("concurrencyInput");
const cacheLimitInput = document.getElementById("cacheLimitInput");
const autoSyncInput = document.getElementById("autoSyncInput");
const syncIntervalInput = document.getElementById("syncIntervalInput");
const connectBtn = document.getElementById("connectBtn");
const accountList = document.getElementById("accountList");
const addAccountBtn = document.getElementById("addAccountBtn");
const searchInput = document.getElementById("searchInput");
const settingsBtn = document.getElementById("settingsBtn");
const aiBackupBtn = document.getElementById("aiBackupBtn");
const helpBtn = document.getElementById("helpBtn");
const githubBtn = document.getElementById("githubBtn");
const connStatus = document.getElementById("connStatus");
const topHint = document.getElementById("topHint");
const uploadStatusBtn = document.getElementById("uploadStatusBtn");
const emptyState = document.getElementById("emptyState");
const emptyStateText = document.getElementById("emptyStateText");
const downloadErrorModal = document.getElementById("downloadErrorModal");
const closeDownloadErrorBtn = document.getElementById("closeDownloadErrorBtn");
const downloadErrorOkBtn = document.getElementById("downloadErrorOkBtn");
const downloadErrorText = document.getElementById("downloadErrorText");
const previewModal = document.getElementById("previewModal");
const closePreviewBtn = document.getElementById("closePreviewBtn");
const previewTitle = document.getElementById("previewTitle");
const previewContent = document.getElementById("previewContent");
const uploadModal = document.getElementById("uploadModal");
const closeUploadModalBtn = document.getElementById("closeUploadModalBtn");
const uploadModalTitle = document.getElementById("uploadModalTitle");
const uploadFileName = document.getElementById("uploadFileName");
const uploadModalProgressBar = document.getElementById("uploadModalProgressBar");
const uploadModalProgressText = document.getElementById("uploadModalProgressText");
const uploadTotalValue = document.getElementById("uploadTotalValue");
const uploadLoadedValue = document.getElementById("uploadLoadedValue");
const uploadSpeedValue = document.getElementById("uploadSpeedValue");
const abortUploadBtn = document.getElementById("abortUploadBtn");
const closeUploadBtn = document.getElementById("closeUploadBtn");
const aiBackupModal = document.getElementById("aiBackupModal");
const aiBackupTitle = document.getElementById("aiBackupTitle");
const closeAiBackupBtn = document.getElementById("closeAiBackupBtn");
const aiBackupForm = document.getElementById("aiBackupForm");
const aiBackupDriveSelect = document.getElementById("aiBackupDriveSelect");
const aiBackupBlockedTypes = document.getElementById("aiBackupBlockedTypes");
const aiBackupCancelBtn = document.getElementById("aiBackupCancelBtn");
const blockSiteChatgpt = document.getElementById("blockSiteChatgpt");
const blockSiteGemini = document.getElementById("blockSiteGemini");
const blockSiteGrok = document.getElementById("blockSiteGrok");
const blockSiteClaude = document.getElementById("blockSiteClaude");
const blockSiteDoubao = document.getElementById("blockSiteDoubao");
const blockSiteDeepseek = document.getElementById("blockSiteDeepseek");
const blockSiteKimi = document.getElementById("blockSiteKimi");
const blockSiteYuanbao = document.getElementById("blockSiteYuanbao");
const blockSiteQianwen = document.getElementById("blockSiteQianwen");
const dialogModal = document.getElementById("dialogModal");
const closeDialogBtn = document.getElementById("closeDialogBtn");
const dialogTitle = document.getElementById("dialogTitle");
const dialogMessage = document.getElementById("dialogMessage");
const dialogForm = document.getElementById("dialogForm");
const dialogInputLabel = document.getElementById("dialogInputLabel");
const dialogInputLabelText = document.getElementById("dialogInputLabelText");
const dialogInput = document.getElementById("dialogInput");
const dialogOkBtn = document.getElementById("dialogOkBtn");
const dialogCancelBtn = document.getElementById("dialogCancelBtn");
const contextMenu = document.getElementById("contextMenu");
const contextMenuEnter = document.getElementById("contextMenuEnter");
const contextMenuPreview = document.getElementById("contextMenuPreview");
const contextMenuDownload = document.getElementById("contextMenuDownload");
const contextMenuCopyPath = document.getElementById("contextMenuCopyPath");
const contextMenuRename = document.getElementById("contextMenuRename");
const contextMenuDelete = document.getElementById("contextMenuDelete");
const accountModal = document.getElementById("accountModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const modalTitle = document.getElementById("modalTitle");
const modalHeader = document.querySelector("#accountModal .modal-header");
const modalCard = document.querySelector("#accountModal .modal-card");
const settingsModal = document.getElementById("settingsModal");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const helpModal = document.getElementById("helpModal");
const helpTitle = document.getElementById("helpTitle");
const closeHelpBtn = document.getElementById("closeHelpBtn");
const globalSettingsForm = document.getElementById("globalSettingsForm");
const languageInput = document.getElementById("languageInput");
const langZhBtn = document.getElementById("langZhBtn");
const langEnBtn = document.getElementById("langEnBtn");
const openModeInput = document.getElementById("openModeInput");
const openModePopupBtn = document.getElementById("openModePopupBtn");
const openModeTabBtn = document.getElementById("openModeTabBtn");
const sortBySelect = document.getElementById("sortBySelect");
const sortOrderInput = document.getElementById("sortOrderInput");
const sortAscBtn = document.getElementById("sortAscBtn");
const sortDescBtn = document.getElementById("sortDescBtn");
const hideDotfilesInput = document.getElementById("hideDotfilesInput");
const clearCacheBtn = document.getElementById("clearCacheBtn");
const globalConcurrencyInput = document.getElementById("globalConcurrencyInput");
const globalCacheLimitInput = document.getElementById("globalCacheLimitInput");
const globalAutoSyncInput = document.getElementById("globalAutoSyncInput");
const globalSyncIntervalInput = document.getElementById("globalSyncIntervalInput");
const logLevelSelect = document.getElementById("logLevelSelect");

let defaults = null;
let viewMode = "list";
let lastListedItems = [];
let i18n = createI18n("zh-CN");

function t(key, vars) {
  return i18n.t(key, vars);
}

function formatErrorDetail(error) {
  return createErrorFormatter(t)(error);
}

const connectionState = {
  isConnected: false,
  connectedAccountId: ""
};

const accountListController = createAccountListController({
  listElement: accountList,
  searchInput,
  t,
  onSelectAccount: async (account) => {
    await connectAccount(account);
  },
  onEditAccount: (account) => {
    openModal(t("ui.accountModal.edit"), account.id);
  },
  onConnectAccount: async (account) => {
    await connectAccount(account);
  },
  onMoveUp: async (account) => {
    await accountsController.moveAccountUp(account.id);
  },
  onMoveDown: async (account) => {
    await accountsController.moveAccountDown(account.id);
  },
  onDeleteAccount: async (account) => {
    await deleteAccount(account.id);
  }
});

const modalController = createModalController({
  modal: accountModal,
  titleElement: modalTitle,
  headerElement: modalHeader,
  cardElement: modalCard,
  closeButton: closeModalBtn
});

const settingsModalController = createModalController({
  modal: settingsModal,
  titleElement: null,
  headerElement: settingsModal?.querySelector(".modal-header"),
  cardElement: settingsModal?.querySelector(".modal-card"),
  closeButton: closeSettingsBtn
});

const helpModalController = createModalController({
  modal: helpModal,
  titleElement: helpTitle,
  headerElement: helpModal?.querySelector(".modal-header"),
  cardElement: helpModal?.querySelector(".modal-card"),
  closeButton: closeHelpBtn
});

const downloadErrorModalController = createModalController({
  modal: downloadErrorModal,
  titleElement: null,
  headerElement: downloadErrorModal?.querySelector(".modal-header"),
  cardElement: downloadErrorModal?.querySelector(".modal-card"),
  closeButton: closeDownloadErrorBtn
});

const previewModalController = createModalController({
  modal: previewModal,
  titleElement: previewTitle,
  headerElement: previewModal?.querySelector(".modal-header"),
  cardElement: previewModal?.querySelector(".modal-card"),
  closeButton: closePreviewBtn
});

const uploadModalController = createModalController({
  modal: uploadModal,
  titleElement: uploadModalTitle,
  headerElement: uploadModal?.querySelector(".modal-header"),
  cardElement: uploadModal?.querySelector(".modal-card"),
  closeButton: closeUploadModalBtn
});

const aiBackupModalController = createModalController({
  modal: aiBackupModal,
  titleElement: aiBackupTitle,
  headerElement: aiBackupModal?.querySelector(".modal-header"),
  cardElement: aiBackupModal?.querySelector(".modal-card"),
  closeButton: closeAiBackupBtn
});

const dialogModalController = createModalController({
  modal: dialogModal,
  titleElement: dialogTitle,
  headerElement: dialogModal?.querySelector(".modal-header"),
  cardElement: dialogModal?.querySelector(".modal-card"),
  closeButton: closeDialogBtn
});

const { setStatus } = createStatusController({
  connStatus,
  topHint,
  getIsConnected: () => connectionState.isConnected
});

const dialogs = createDialogsController({
  modal: dialogModal,
  modalController: dialogModalController,
  titleElement: dialogTitle,
  messageElement: dialogMessage,
  inputLabel: dialogInputLabel,
  inputLabelText: dialogInputLabelText,
  input: dialogInput,
  form: dialogForm,
  okButton: dialogOkBtn,
  cancelButton: dialogCancelBtn,
  closeButton: closeDialogBtn,
  t
});

const accountsController = createAccountsController({
  storage: {
    loadAccounts,
    saveAccounts,
    loadActiveAccountId,
    saveActiveAccountId
  },
  accountListController,
  modalController,
  inputs: {
    nameInput,
    endpointInput,
    usernameInput,
    passwordInput,
    rootInput,
    concurrencyInput,
    cacheLimitInput,
    autoSyncInput,
    syncIntervalInput,
    pathInput
  },
  defaultsProvider: () => defaults,
  createAccountId,
  getAccountName,
  dialogs,
  t
});

const aiBackupController = createAiBackupController({
  t,
  aiBackupBtn,
  cancelBtn: aiBackupCancelBtn,
  form: aiBackupForm,
  modalController: aiBackupModalController,
  blockedTypesInput: aiBackupBlockedTypes,
  driveSelect: aiBackupDriveSelect,
  siteCheckboxes: {
    chatgpt: blockSiteChatgpt,
    gemini: blockSiteGemini,
    grok: blockSiteGrok,
    claude: blockSiteClaude,
    doubao: blockSiteDoubao,
    deepseek: blockSiteDeepseek,
    kimi: blockSiteKimi,
    yuanbao: blockSiteYuanbao,
    qianwen: blockSiteQianwen
  },
  loadSettings: loadAiBackupSettings,
  saveSettings: saveAiBackupSettings,
  getAccounts: () => accountsController.getAccounts(),
  getAccountName,
  flashTopHint
});
aiBackupController.init();

createSidebarFooterController({
  helpBtn,
  githubBtn,
  helpModalController,
  t
}).init();
const { showDownloadError } = createDownloadErrorModal({
  modalController: downloadErrorModalController,
  downloadErrorText,
  okButton: downloadErrorOkBtn
});

const clientFactory = createClientFactory({
  WebDavClient,
  getActiveAccount,
  endpointInput,
  usernameInput,
  passwordInput,
  rootInput
});

const fileOps = createFileOps({
  sendMessage,
  clientFactory,
  relativePathFromHref
});

const pathNav = createPathNavigation({
  pathInput,
  pathChips,
  normalizePath,
  listPath: async () => await listPath()
});

const connectionController = createConnectionController({
  connectionState,
  accountsController,
  fileOps,
  pathNav,
  inputs: {
    endpointInput,
    nameInput,
    pathInput
  },
  setStatus,
  formatErrorDetail,
  getAccountName,
  listPath: async () => await listPath(),
  openModal,
  closeModal,
  t,
  onDisconnected: () => {
    lastListedItems = [];
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = null;
    }
    fileListController.setItems([]);
    fileListController.applyFilter(searchInput?.value);
    showEmptyState("disconnected");
  }
});

const previewController = createPreviewController({
  previewModal,
  previewContent,
  modalController: previewModalController,
  closeButton: closePreviewBtn,
  setStatus,
  showDownloadError,
  createClientFromActiveAccount: clientFactory.createClientFromActiveAccount,
  relativePathFromHref,
  formatErrorDetail,
  formatSize,
  t,
  logger: {
    debug: logDebug,
    info: logInfo,
    warn: logWarn,
    error: logError
  },
  onBackgroundStateChange: (state) => {
    if (!previewProgressBtn) {
      return;
    }
    const visible = Boolean(state?.visible);
    previewProgressBtn.hidden = !visible;
    if (!visible) {
      return;
    }
    const key = state?.state === "ready" ? "preview.backgroundReady" : "preview.backgroundLoading";
    const title = t(key);
    previewProgressBtn.setAttribute("title", title);
    previewProgressBtn.setAttribute("aria-label", title);
  }
});

previewController.bindCleanupOnClose();

const contextMenuController = createContextMenuController({
  contextMenu,
  contextMenuEnter,
  contextMenuPreview,
  contextMenuDownload,
  contextMenuCopyPath,
  contextMenuRename,
  contextMenuDelete,
  fileList,
  relativePathFromHref,
  copyTextToClipboard,
  setStatus,
  t,
  onEnter: async (item) => await pathNav.enterDirectory(item),
  onPreview: async (item) => await previewController.previewItem(item),
  onDownload: async (item) => await downloadItem(item),
  onRename: async (item) => await renameItem(item),
  onDelete: async (item) => await deleteItem(item)
});

const fileListController = createFileListController({
  listElement: fileList,
  getIconPath: getFileIconPath,
  formatDate,
  formatSize,
  onEnterDir: async (item) => await pathNav.enterDirectory(item),
  onPreview: async (item) => await previewController.previewItem(item),
  onOpenContextMenu: (x, y, item) => {
    contextMenuController.open(x, y, item);
  }
});

function getEmptyStateMessage(mode) {
  const normalized = mode === "search" ? "search" : "disconnected";
  if (normalized === "search") {
    return t("empty.searchNoResult");
  }
  const endpoint = endpointInput?.value?.trim() || "";
  if (!endpoint) {
    return t("status.needEndpoint");
  }
  if (!connectionController.isConnected()) {
    return t("status.connectHint");
  }
  return "";
}

function showEmptyState(mode) {
  if (!emptyState) {
    return;
  }
  const message = getEmptyStateMessage(mode);
  if (emptyStateText) {
    emptyStateText.textContent = message;
  }
  emptyState.hidden = false;
}

function hideEmptyState() {
  if (!emptyState) {
    return;
  }
  if (emptyStateText) {
    emptyStateText.textContent = "";
  }
  emptyState.hidden = true;
}

let topHintFlashTimer = null;
let topHintFlashToken = 0;

let activeUpload = null;

function setUploadStatusVisible(visible) {
  if (!uploadStatusBtn) {
    return;
  }
  uploadStatusBtn.hidden = !visible;
}

function updateUploadModalUi() {
  if (!activeUpload) {
    if (uploadFileName) {
      uploadFileName.textContent = "";
    }
    if (uploadModalProgressBar) {
      uploadModalProgressBar.style.width = "0%";
    }
    if (uploadModalProgressText) {
      uploadModalProgressText.textContent = "";
    }
    if (uploadTotalValue) {
      uploadTotalValue.textContent = "";
    }
    if (uploadLoadedValue) {
      uploadLoadedValue.textContent = "";
    }
    if (uploadSpeedValue) {
      uploadSpeedValue.textContent = "";
    }
    if (abortUploadBtn) {
      abortUploadBtn.disabled = true;
    }
    return;
  }
  if (uploadFileName) {
    uploadFileName.textContent = activeUpload.name || "";
  }
  if (uploadModalProgressBar) {
    uploadModalProgressBar.style.width = `${activeUpload.percent || 0}%`;
  }
  if (uploadModalProgressText) {
    const percent = Math.round(activeUpload.percent || 0);
    uploadModalProgressText.textContent = t("common.uploadingProgress", { percent });
  }
  if (uploadTotalValue) {
    uploadTotalValue.textContent = formatSize(activeUpload.totalBytes || 0);
  }
  if (uploadLoadedValue) {
    uploadLoadedValue.textContent = formatSize(activeUpload.loadedBytes || 0);
  }
  if (uploadSpeedValue) {
    const speed = activeUpload.speedBps || 0;
    uploadSpeedValue.textContent = speed ? `${formatSize(speed)}/s` : "-";
  }
  if (abortUploadBtn) {
    abortUploadBtn.disabled = typeof activeUpload.abort !== "function";
  }
}

function openUploadModal() {
  updateUploadModalUi();
  uploadModalController.open(t("upload.title"));
}

function closeUploadModal() {
  uploadModalController.close();
}

function endUploadUi() {
  activeUpload = null;
  setUploadStatusVisible(false);
  updateUploadModalUi();
  closeUploadModal();
}

function flashTopHint(message, durationMs = 1100) {
  if (!topHint) {
    return;
  }
  const text = String(message || "");
  if (!text) {
    return;
  }
  const prev = topHint.textContent || "";
  topHintFlashToken += 1;
  const token = topHintFlashToken;
  topHint.textContent = text;
  if (topHintFlashTimer) {
    clearTimeout(topHintFlashTimer);
  }
  topHintFlashTimer = setTimeout(() => {
    if (token !== topHintFlashToken) {
      return;
    }
    if (topHint.textContent === text) {
      topHint.textContent = prev;
    }
  }, Number(durationMs) || 1100);
}

let searchDebounceTimer = null;

function syncListStatus(result, activeName) {
  if (result.keyword) {
    setStatus(t("common.connected"), t("status.shown", { name: activeName, shown: result.shown, total: result.total }), "connected");
  } else {
    setStatus(t("common.connected"), t("status.total", { name: activeName, total: result.total }), "connected");
  }
  if (result.keyword && result.shown === 0) {
    showEmptyState("search");
  } else {
    hideEmptyState();
  }
}

function applySearchFilterNow() {
  if (!connectionController.isConnected()) {
    return;
  }
  const result = fileListController.applyFilter(searchInput?.value);
  const activeName = getAccountName(getActiveAccount());
  syncListStatus(result, activeName);
}

function scheduleSearchFilter() {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
  }
  searchDebounceTimer = setTimeout(() => {
    applySearchFilterNow();
  }, 120);
}

function applyViewMode(nextMode) {
  viewMode = nextMode === "grid" ? "grid" : "list";
  if (viewMode === "grid") {
    fileList.classList.add("view-grid");
    if (viewToggleIcon) {
      viewToggleIcon.src = "images/view-grid.svg";
    }
    viewToggleBtn?.setAttribute("title", t("ui.layoutGrid"));
  } else {
    fileList.classList.remove("view-grid");
    if (viewToggleIcon) {
      viewToggleIcon.src = "images/view-list.svg";
    }
    viewToggleBtn?.setAttribute("title", t("ui.layoutList"));
  }
}

function getActiveAccount() {
  return accountsController.getActiveAccount();
}

function applyLanguageUi(language) {
  const normalized = normalizeLanguage(language);
  if (languageInput) {
    languageInput.value = normalized;
  }
  if (langZhBtn) {
    langZhBtn.setAttribute("aria-pressed", normalized === "zh-CN" ? "true" : "false");
  }
  if (langEnBtn) {
    langEnBtn.setAttribute("aria-pressed", normalized === "en" ? "true" : "false");
  }
}

function setLanguage(language) {
  i18n = createI18n(language);
  applyI18n(document, i18n);
  applyLanguageUi(language);
  applyViewMode(viewMode);
  accountListController?.render?.();
}

function applyOpenModeUi(mode) {
  const normalized = mode === "popup" ? "popup" : "tab";
  if (openModeInput) {
    openModeInput.value = normalized;
  }
  if (openModePopupBtn) {
    openModePopupBtn.setAttribute("aria-pressed", normalized === "popup" ? "true" : "false");
  }
  if (openModeTabBtn) {
    openModeTabBtn.setAttribute("aria-pressed", normalized === "tab" ? "true" : "false");
  }
}

function applySortOrderUi(order) {
  const normalized = order === "desc" ? "desc" : "asc";
  if (sortOrderInput) {
    sortOrderInput.value = normalized;
  }
  if (sortAscBtn) {
    sortAscBtn.setAttribute("aria-pressed", normalized === "asc" ? "true" : "false");
  }
  if (sortDescBtn) {
    sortDescBtn.setAttribute("aria-pressed", normalized === "desc" ? "true" : "false");
  }
}

function applyListPreferences(items, settings) {
  const base = Array.isArray(items) ? items : [];
  const hideDotfiles = Boolean(settings?.hideDotfiles);
  const sortBy = settings?.sortBy === "modified" || settings?.sortBy === "size" ? settings.sortBy : "name";
  const sortOrder = settings?.sortOrder === "desc" ? -1 : 1;
  const filtered = hideDotfiles
    ? base.filter((item) => !String(item?.name || "").startsWith("."))
    : base;

  function getModifiedValue(item) {
    const value = Date.parse(String(item?.modified || ""));
    return Number.isFinite(value) ? value : 0;
  }

  function getSizeValue(item) {
    return Number(item?.size || 0) || 0;
  }

  return [...filtered].sort((a, b) => {
    if (Boolean(a?.isDir) !== Boolean(b?.isDir)) {
      return a?.isDir ? -1 : 1;
    }
    let cmp = 0;
    if (sortBy === "modified") {
      cmp = getModifiedValue(a) - getModifiedValue(b);
    } else if (sortBy === "size") {
      cmp = getSizeValue(a) - getSizeValue(b);
    } else {
      const an = String(a?.name || "");
      const bn = String(b?.name || "");
      cmp = an.localeCompare(bn, undefined, { numeric: true, sensitivity: "base" });
    }
    return cmp * sortOrder;
  });
}

function setFormFromSettings(settings) {
  const base = settings || {};
  applyOpenModeUi(base.openMode);
  if (sortBySelect) {
    sortBySelect.value = base.sortBy === "modified" || base.sortBy === "size" ? base.sortBy : "name";
  }
  applySortOrderUi(base.sortOrder);
  if (hideDotfilesInput) {
    hideDotfilesInput.checked = Boolean(base.hideDotfiles);
  }
  globalConcurrencyInput.value = base.concurrency ?? 2;
  globalCacheLimitInput.value = base.cacheLimitMb ?? 200;
  globalAutoSyncInput.checked = Boolean(base.autoSync);
  globalSyncIntervalInput.value = normalizeIntervalMinutes(base.syncIntervalMinutes, 30);
  if (logLevelSelect) {
    logLevelSelect.value = String(base.logLevel || "warn");
  }
}

async function setActiveAccount(accountId) {
  await connectionController.setActiveAccount(accountId);
}

function collectAccount(accountId) {
  return accountsController.collectAccount(accountId);
}

async function upsertAccount(account, options = {}) {
  await connectionController.upsertAccount(account, options);
}

async function deleteAccount(accountId) {
  await connectionController.deleteAccount(accountId);
}

async function connectAccount(account) {
  await connectionController.connectAccount(account);
}

function openModal(title, accountId = "") {
  accountsController.openModal(title, accountId);
}

function closeModal() {
  accountsController.closeModal();
}

const EXT_ICON_MAP = {
  aac: "images/aac.svg",
  asp: "images/asp.svg",
  avi: "images/file-video.svg",
  bmp: "images/bmp.svg",
  bz2: "images/file-archive.svg",
  c: "images/file-code.svg",
  cpp: "images/file-code.svg",
  csv: "images/csv.svg",
  css: "images/file-code.svg",
  doc: "images/doc.svg",
  docx: "images/docx.svg",
  flac: "images/flac.svg",
  gif: "images/gif.svg",
  go: "images/file-code.svg",
  gz: "images/file-archive.svg",
  h: "images/file-code.svg",
  hpp: "images/file-code.svg",
  html: "images/html.svg",
  ico: "images/file-ico.svg",
  java: "images/file-code.svg",
  jpeg: "images/jpg.svg",
  jpg: "images/jpg.svg",
  js: "images/js.svg",
  json: "images/file-code.svg",
  log: "images/txt.svg",
  m4a: "images/m4a.svg",
  md: "images/txt.svg",
  midi: "images/midi.svg",
  mkv: "images/mkv.svg",
  mov: "images/file-video.svg",
  mp2: "images/mp2.svg",
  mp3: "images/mp3.svg",
  mp4: "images/mp4.svg",
  m4v: "images/file-video.svg",
  ogg: "images/ogg.svg",
  ogv: "images/ogv.svg",
  pdf: "images/pdf.svg",
  php: "images/php.svg",
  png: "images/png.svg",
  ppt: "images/ppt.svg",
  pptx: "images/pptx.svg",
  py: "images/file-code.svg",
  rar: "images/rar.svg",
  rs: "images/file-code.svg",
  sh: "images/file-code.svg",
  svg: "images/svg.svg",
  tar: "images/file-archive.svg",
  ts: "images/file-code.svg",
  tsx: "images/file-code.svg",
  txt: "images/txt.svg",
  wav: "images/wav.svg",
  webm: "images/webm.svg",
  webp: "images/webp.svg",
  xls: "images/xls.svg",
  xlsx: "images/xlsx.svg",
  xml: "images/file-code.svg",
  xz: "images/file-archive.svg",
  yaml: "images/file-code.svg",
  yml: "images/file-code.svg",
  zip: "images/zip.svg",
  "7z": "images/file-archive.svg"
};

function getFileIconPath(item) {
  if (item?.isDir) {
    return "images/folder.svg";
  }
  const name = (item?.name || "").toLowerCase();
  const ext = name.includes(".") ? name.split(".").pop() : "";
  return EXT_ICON_MAP[ext] || "images/file.svg";
}

async function copyTextToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

async function downloadItem(item) {
  if (!item || item.isDir) {
    showDownloadError(t("status.selectFile"));
    return;
  }
  downloadErrorModalController.close();
  setStatus(t("common.downloading"));
  try {
    await fileOps.downloadByHref(item.href, item.name);
    setStatus(t("common.done"));
  } catch (error) {
    setStatus("");
    const detail = error?.status ? formatErrorDetail(error) : error?.message || String(error);
    showDownloadError(detail);
  }
}

async function deleteItem(item) {
  if (!item) {
    setStatus(t("status.selectItemToDelete"));
    return;
  }
  const ok = await dialogs.confirm({
    title: t("ui.delete"),
    message: t("dialog.deleteItem.message", { name: item.name, suffix: item.isDir ? "/" : "" })
  });
  if (!ok) {
    return;
  }
  setStatus(t("common.deleting"));
  try {
    await fileOps.removeByHref(item.href);
    await listPath();
  } catch (error) {
    setStatus(t("common.error"), formatErrorDetail(error));
  }
}

async function renameItem(item) {
  if (!item) {
    setStatus(t("status.selectItemToRename"));
    return;
  }
  const nextName = await dialogs.prompt({
    title: t("dialog.renameItem.title"),
    message: t("dialog.renameItem.message", { name: item.name, suffix: item.isDir ? "/" : "" }),
    label: t("dialog.renameItem.label"),
    value: item.name || "",
    placeholder: t("dialog.renameItem.placeholder")
  });
  const trimmed = String(nextName || "").trim();
  if (!trimmed || trimmed === item.name) {
    return;
  }
  if (trimmed.includes("/") || trimmed.includes("\\")) {
    setStatus(t("common.error"), t("error.nameInvalid"));
    return;
  }
  setStatus(t("common.renaming"));
  try {
    await fileOps.renameByHref(item.href, trimmed, item.isDir);
    await listPath();
    setStatus(t("common.done"));
  } catch (error) {
    setStatus(t("status.renameFailed"), formatErrorDetail(error));
  }
}

function relativePathFromHref(href) {
  const account = getActiveAccount() || {};
  const rootPath = normalizePath(account.rootPath || rootInput.value || "/");
  const endpoint = (account.endpoint || endpointInput.value || "").trim();
  let basePath = "/";
  if (endpoint) {
    try {
      const endpointUrl = new URL(endpoint);
      basePath = endpointUrl.pathname || "/";
    } catch {
      basePath = "/";
    }
  }
  const normalizedBase = normalizePath(basePath);

  function stripPathPrefix(inputPath, prefixPath) {
    const path = normalizePath(inputPath);
    const prefix = normalizePath(prefixPath);
    if (prefix === "/") {
      return path;
    }
    const withSlash = prefix.endsWith("/") ? prefix : `${prefix}/`;
    if (path === prefix) {
      return "/";
    }
    if (path.startsWith(withSlash)) {
      return normalizePath(path.slice(prefix.length));
    }
    return path;
  }

  try {
    const url = endpoint ? new URL(href, endpoint) : new URL(href);
    let path = url.pathname || "/";
    path = stripPathPrefix(path, normalizedBase);
    path = stripPathPrefix(path, rootPath);
    return normalizePath(path);
  } catch {
    let path = href || "/";
    if (path.includes("://")) {
      try {
        const url = new URL(path);
        path = url.pathname || "/";
      } catch {
        path = href || "/";
      }
    }
    path = stripPathPrefix(path, rootPath);
    return normalizePath(path);
  }
}

async function listPath() {
  if (!endpointInput.value.trim()) {
    setStatus(t("status.needEndpoint"));
    lastListedItems = [];
    fileListController.setItems([]);
    fileListController.applyFilter(searchInput?.value);
    showEmptyState("disconnected");
    return;
  }
  if (!connectionController.isConnected()) {
    setStatus(t("common.disconnected"), t("status.needConnectToBrowse"), "disconnected");
    lastListedItems = [];
    fileListController.setItems([]);
    fileListController.applyFilter(searchInput?.value);
    showEmptyState("disconnected");
    return;
  }
  const path = normalizePath(pathInput.value || "/");
  if (upBtn) {
    upBtn.disabled = path === "/";
  }
  pathNav.updatePathChips();
  const activeName = getAccountName(getActiveAccount());
  setStatus(t("common.connected"), t("status.currentAccountLoading", { name: activeName }), "connected");
  try {
    const items = await fileOps.list(path);
    lastListedItems = items;
    const preferred = applyListPreferences(items, defaults);
    fileListController.setItems(preferred);
    const result = fileListController.applyFilter(searchInput?.value);
    syncListStatus(result, activeName);
  } catch (error) {
    setStatus(t("common.error"), formatErrorDetail(error));
  }
}

async function hydrateSettings() {
  defaults = await loadSettings();
  setLogLevel(defaults?.logLevel);
  await aiBackupController.hydrate();
  setLanguage(defaults.language);
  viewMode = await loadViewMode();
  applyViewMode(viewMode);
  await accountsController.hydrate();
  setStatus(t("common.disconnected"), t("status.connectHint"), "disconnected");
  lastListedItems = [];
  fileListController.setItems([]);
  fileListController.applyFilter(searchInput?.value);
  showEmptyState("disconnected");
}

settingsForm.addEventListener("submit", async (event) => {
  await connectionController.handleSettingsSubmit(event);
});

connectBtn.addEventListener("click", async () => {
  await connectionController.handleConnectClick();
});

addAccountBtn.addEventListener("click", () => {
  connectionController.handleAddAccountClick();
});

settingsBtn?.addEventListener("click", async () => {
  if (!defaults) {
    defaults = await loadSettings();
  }
  setFormFromSettings(defaults);
  settingsModalController.open();
});

viewToggleBtn?.addEventListener("click", async () => {
  const next = viewMode === "grid" ? "list" : "grid";
  applyViewMode(next);
  await saveViewMode(next);
  const result = fileListController.applyFilter(searchInput?.value);
  if (result.keyword && result.shown === 0 && connectionController.isConnected()) {
    showEmptyState("search");
  } else if (connectionController.isConnected()) {
    hideEmptyState();
  } else {
    showEmptyState("disconnected");
  }
});

previewProgressBtn?.addEventListener("click", () => {
  previewController?.openProgress?.();
});

langZhBtn?.addEventListener("click", () => {
  setLanguage("zh-CN");
});

langEnBtn?.addEventListener("click", () => {
  setLanguage("en");
});

openModePopupBtn?.addEventListener("click", () => {
  applyOpenModeUi("popup");
});

openModeTabBtn?.addEventListener("click", () => {
  applyOpenModeUi("tab");
});

sortAscBtn?.addEventListener("click", () => {
  applySortOrderUi("asc");
});

sortDescBtn?.addEventListener("click", () => {
  applySortOrderUi("desc");
});

homeBtn?.addEventListener("click", async () => {
  if (normalizePath(pathInput.value || "/") === "/") {
    return;
  }
  pathInput.value = "/";
  await listPath();
});

upBtn?.addEventListener("click", async () => {
  const current = normalizePath(pathInput.value || "/");
  if (current === "/") {
    return;
  }
  const trimmed = current.endsWith("/") ? current.slice(0, -1) : current;
  const parts = trimmed.split("/").filter(Boolean);
  parts.pop();
  pathInput.value = parts.length ? `/${parts.join("/")}` : "/";
  await listPath();
});

searchInput?.addEventListener("input", () => {
  if (!connectionController.isConnected()) {
    return;
  }
  scheduleSearchFilter();
});

globalSettingsForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const sortBy = sortBySelect?.value === "modified" || sortBySelect?.value === "size" ? sortBySelect.value : "name";
  const next = {
    language: normalizeLanguage(languageInput?.value),
    concurrency: Number(globalConcurrencyInput.value || 2),
    cacheLimitMb: Number(globalCacheLimitInput.value || 200),
    autoSync: globalAutoSyncInput.checked,
    syncIntervalMinutes: normalizeIntervalMinutes(globalSyncIntervalInput.value, 30),
    openMode: openModeInput?.value === "popup" ? "popup" : "tab",
    sortBy,
    sortOrder: sortOrderInput?.value === "desc" ? "desc" : "asc",
    hideDotfiles: Boolean(hideDotfilesInput?.checked),
    logLevel: String(logLevelSelect?.value || "warn")
  };
  await saveSettings(next);
  defaults = next;
  setLogLevel(defaults?.logLevel);
  if (connectionController.isConnected() && endpointInput.value.trim()) {
    const preferred = applyListPreferences(lastListedItems, defaults);
    fileListController.setItems(preferred);
    const result = fileListController.applyFilter(searchInput?.value);
    const activeName = getAccountName(getActiveAccount());
    syncListStatus(result, activeName);
  }
  setStatus(t("status.settingsSaved"));
  settingsModalController.close();
});

clearCacheBtn?.addEventListener("click", async () => {
  const ok = await dialogs.confirm({
    title: t("dialog.clearCache.title"),
    message: t("dialog.clearCache.message"),
    okText: t("dialog.clearCache.ok"),
    cancelText: t("common.cancel")
  });
  if (!ok) {
    return;
  }
  setStatus(t("status.clearingCache"));
  try {
    await sendMessage({ type: "clearCache" });
    setStatus(t("common.cacheCleared"));
    flashTopHint(t("common.cacheCleared"));
  } catch (error) {
    setStatus(t("common.error"), formatErrorDetail(error), "error");
  }
});

refreshBtn.addEventListener("click", async () => {
  try {
    await listPath();
    if (endpointInput.value.trim() && connectionController.isConnected()) {
      flashTopHint(t("common.refreshDone"));
    }
  } catch (error) {
    setStatus(t("common.error"), formatErrorDetail(error), "error");
  }
});

uploadStatusBtn?.addEventListener("click", () => {
  if (!activeUpload) {
    return;
  }
  openUploadModal();
});

closeUploadBtn?.addEventListener("click", () => {
  closeUploadModal();
});

abortUploadBtn?.addEventListener("click", () => {
  if (!activeUpload || typeof activeUpload.abort !== "function") {
    return;
  }
  activeUpload.abort();
});

uploadInput.addEventListener("change", async () => {
  const file = uploadInput.files?.[0];
  if (!file) {
    return;
  }
  const path = normalizePath(`${pathInput.value}/${file.name}`);
  if (activeUpload?.abort) {
    try {
      activeUpload.abort();
    } catch {}
  }
  setStatus(t("common.uploading"));
  setUploadStatusVisible(true);
  const startedAt = performance.now();
  let lastLoaded = 0;
  let lastTs = startedAt;
  let speedBps = 0;

  const task = fileOps.upload(path, file, {
    onProgress: ({ loaded, total, percent }) => {
      const now = performance.now();
      const deltaBytes = Math.max(0, Number(loaded || 0) - lastLoaded);
      const deltaSec = Math.max(0, (now - lastTs) / 1000);
      const instant = deltaSec > 0 ? deltaBytes / deltaSec : 0;
      speedBps = speedBps ? speedBps * 0.75 + instant * 0.25 : instant;
      lastLoaded = Number(loaded || 0) || 0;
      lastTs = now;
      activeUpload = {
        name: file.name || "",
        totalBytes: Number(total || file.size || 0) || 0,
        loadedBytes: lastLoaded,
        percent: Number(percent || 0) || 0,
        speedBps,
        abort: task?.abort || null
      };
      updateUploadModalUi();
    }
  });
  activeUpload = {
    name: file.name || "",
    totalBytes: Number(file.size || 0) || 0,
    loadedBytes: 0,
    percent: 0,
    speedBps: 0,
    abort: task?.abort || null
  };
  updateUploadModalUi();
  try {
    await task.promise;
    flashTopHint(t("common.uploadDone"));
    await listPath();
  } catch (error) {
    if (error?.code === "aborted") {
      flashTopHint(t("common.uploadCanceled"));
    } else {
      setStatus(t("common.error"), formatErrorDetail(error), "error");
    }
  } finally {
    endUploadUi();
    uploadInput.value = "";
  }
});

downloadBtn.addEventListener("click", async () => {
  await downloadItem(fileListController.getSelectedItem());
});

deleteBtn.addEventListener("click", async () => {
  await deleteItem(fileListController.getSelectedItem());
});

mkdirBtn.addEventListener("click", async () => {
  const name = await dialogs.prompt({
    title: t("dialog.mkdir.title"),
    label: t("dialog.mkdir.label"),
    placeholder: t("dialog.mkdir.placeholder")
  });
  const trimmed = String(name || "").trim();
  if (!trimmed) {
    return;
  }
  if (trimmed.includes("/") || trimmed.includes("\\")) {
    setStatus(t("common.error"), t("error.folderNameInvalid"), "error");
    return;
  }
  setStatus(t("common.creating"));
  try {
    const path = normalizePath(`${pathInput.value}/${trimmed}`);
    await fileOps.mkdir(path);
    await listPath();
  } catch (error) {
    setStatus(t("common.error"), formatErrorDetail(error), "error");
  }
});

hydrateSettings().catch((error) => {
  setStatus(t("common.error"), formatErrorDetail(error), "error");
});
