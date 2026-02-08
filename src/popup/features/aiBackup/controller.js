export function createAiBackupController(options) {
  const {
    t,
    aiBackupBtn,
    cancelBtn,
    form,
    modalController,
    blockedTypesInput,
    driveSelect,
    siteCheckboxes,
    loadSettings,
    saveSettings,
    getAccounts,
    getAccountName,
    flashTopHint
  } = options;

  let settings = null;

  function parseExtensionList(text) {
    return String(text || "")
      .split(/[,，\s]+/g)
      .map((v) => String(v || "").trim().toLowerCase().replace(/^\./, ""))
      .filter(Boolean);
  }

  function getModeFromForm() {
    const picked = form?.querySelector('input[name="aiBackupMode"]:checked')?.value || "off";
    return picked === "auto" || picked === "ask" ? picked : "off";
  }

  function setDriveOptions(selectedAccountId) {
    if (!driveSelect) {
      return;
    }
    const wanted = String(selectedAccountId || "");
    const accounts = typeof getAccounts === "function" ? getAccounts() : [];
    driveSelect.innerHTML = "";
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = t?.("aiBackup.drive.current") || "当前网盘（跟随左侧选中账号）";
    driveSelect.appendChild(defaultOption);
    for (const account of accounts) {
      const option = document.createElement("option");
      option.value = account.id;
      option.textContent = typeof getAccountName === "function" ? getAccountName(account) : String(account?.name || "");
      driveSelect.appendChild(option);
    }
    const validSelected = wanted && accounts.some((a) => a.id === wanted);
    driveSelect.value = validSelected ? wanted : "";
  }

  function setFormFromSettings(next) {
    const base = next || {};
    const mode = base.mode === "auto" || base.mode === "ask" ? base.mode : "off";
    const radios = form?.querySelectorAll('input[name="aiBackupMode"]') || [];
    for (const radio of radios) {
      if (radio instanceof HTMLInputElement) {
        radio.checked = radio.value === mode;
      }
    }
    setDriveOptions(base.backupAccountId);
    if (blockedTypesInput) {
      const list = Array.isArray(base.blockedExtensions) ? base.blockedExtensions : [];
      blockedTypesInput.value = list.join(", ");
    }
    const blockedSites = new Set((Array.isArray(base.blockedSites) ? base.blockedSites : []).map((v) => String(v || "").toLowerCase()));
    for (const [site, el] of Object.entries(siteCheckboxes || {})) {
      if (el) {
        el.checked = blockedSites.has(String(site).toLowerCase());
      }
    }
  }

  function collectFromForm() {
    const blockedExtensions = parseExtensionList(blockedTypesInput?.value);
    const blockedSites = [];
    for (const [site, el] of Object.entries(siteCheckboxes || {})) {
      if (el?.checked) {
        blockedSites.push(String(site).toLowerCase());
      }
    }
    const backupAccountId = String(driveSelect?.value || "").trim();
    return {
      mode: getModeFromForm(),
      blockedExtensions: [...new Set(blockedExtensions)],
      blockedSites: [...new Set(blockedSites)],
      backupAccountId
    };
  }

  async function hydrate() {
    settings = await loadSettings();
  }

  async function open() {
    if (!settings) {
      await hydrate();
    }
    setFormFromSettings(settings);
    modalController.open();
  }

  async function saveFromForm() {
    const next = collectFromForm();
    await saveSettings(next);
    settings = next;
    flashTopHint?.(t?.("aiBackup.saved") || "AI 备份设置已保存");
    modalController.close();
  }

  function init() {
    aiBackupBtn?.addEventListener("click", () => {
      open().catch(() => {});
    });
    cancelBtn?.addEventListener("click", () => {
      modalController.close();
    });
    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      saveFromForm().catch(() => {});
    });
  }

  function getSettings() {
    return settings;
  }

  return {
    init,
    hydrate,
    open,
    getSettings,
    setDriveOptions
  };
}

