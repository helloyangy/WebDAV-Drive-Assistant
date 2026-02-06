export function createConnectionController(options) {
  const {
    connectionState,
    accountsController,
    fileOps,
    pathNav,
    inputs,
    setStatus,
    formatErrorDetail,
    getAccountName,
    listPath,
    openModal,
    closeModal,
    onDisconnected,
    t
  } = options;

  const { endpointInput, nameInput, pathInput } = inputs;

  function isConnected() {
    return Boolean(connectionState.isConnected);
  }

  function getConnectedAccountId() {
    return String(connectionState.connectedAccountId || "");
  }

  function setDisconnected() {
    connectionState.isConnected = false;
    connectionState.connectedAccountId = "";
    setStatus(t?.("common.disconnected") || "未连接", t?.("status.connectHint") || "点击左侧账号连接", "disconnected");
    if (typeof onDisconnected === "function") {
      onDisconnected();
    }
  }

  async function setActiveAccount(accountId) {
    await accountsController.setActiveAccount(accountId);
    if (getConnectedAccountId() && getConnectedAccountId() !== accountId) {
      setDisconnected();
    }
  }

  async function upsertAccount(account, options = {}) {
    await accountsController.upsertAccount(account, options);
    const nextId = accountsController.getActiveAccountId();
    if (getConnectedAccountId() && nextId && getConnectedAccountId() !== nextId) {
      setDisconnected();
    }
  }

  async function deleteAccount(accountId) {
    const result = await accountsController.deleteAccount(accountId);
    if (result.deleted) {
      setStatus(t?.("status.accountDeleted") || "账号已删除");
      const nextId = accountsController.getActiveAccountId();
      if (getConnectedAccountId() && nextId && getConnectedAccountId() !== nextId) {
        setDisconnected();
      }
    }
  }

  async function connectAccount(account) {
    if (isConnected() && getConnectedAccountId() === account.id) {
      setStatus(t?.("common.connected") || "已连接", t?.("status.currentAccount", { name: getAccountName(account) }) || "", "connected");
      return;
    }

    await setActiveAccount(account.id);
    setStatus(t?.("common.connecting") || "连接中...", "", "connecting");
    try {
      await fileOps.list(account.rootPath || "/");
      connectionState.isConnected = true;
      connectionState.connectedAccountId = account.id;
      pathInput.value = account.rootPath || "/";
      pathNav.updatePathChips();
      await listPath();
      setStatus(t?.("common.connected") || "已连接", t?.("status.currentAccount", { name: getAccountName(account) }) || "", "connected");
    } catch (error) {
      setDisconnected();
      setStatus(t?.("common.connectFailed") || "连接失败", formatErrorDetail(error), "error");
    }
  }

  async function handleSettingsSubmit(event) {
    event.preventDefault();
    const editingId = accountsController.getEditingAccountId();
    const account = accountsController.collectAccount(editingId || "");
    const shouldActivate = Boolean(editingId) || !accountsController.getActiveAccountId();
    await upsertAccount(account, { setActive: shouldActivate });
    setStatus(t?.("ui.saveSettings") || "保存设置");
    closeModal();
  }

  async function handleConnectClick() {
    if (!endpointInput.value.trim()) {
      setStatus(t?.("status.needEndpoint") || "请先填写服务器地址");
      return;
    }

    setStatus(t?.("common.connecting") || "连接中...", "", "connecting");
    try {
      const account = accountsController.collectAccount(accountsController.getEditingAccountId() || "");
      await upsertAccount(account);
      await fileOps.list(account.rootPath || "/");
      connectionState.isConnected = true;
      connectionState.connectedAccountId = account.id;
      pathInput.value = account.rootPath || "/";
      await listPath();
      setStatus(t?.("common.connected") || "已连接", t?.("status.currentAccount", { name: getAccountName(account) }) || "", "connected");
      closeModal();
    } catch (error) {
      setDisconnected();
      setStatus(t?.("common.connectFailed") || "连接失败", formatErrorDetail(error), "error");
    }
  }

  function handleAddAccountClick() {
    const defaultName = `账号 ${accountsController.getAccounts().length + 1}`;
    nameInput.value = defaultName;
    openModal(t?.("ui.accountModal.add") || "新增账号");
    setStatus(t?.("status.fillConnectionInfo") || "请填写连接信息");
  }

  return {
    isConnected,
    getConnectedAccountId,
    setActiveAccount,
    upsertAccount,
    deleteAccount,
    connectAccount,
    handleSettingsSubmit,
    handleConnectClick,
    handleAddAccountClick
  };
}
