export function createAccountsController(options) {
  const {
    storage,
    accountListController,
    modalController,
    inputs,
    defaultsProvider,
    createAccountId,
    getAccountName,
    dialogs,
    t
  } = options;

  const {
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
  } = inputs;

  let accounts = [];
  let activeAccountId = "";
  let editingAccountId = "";

  function getAccounts() {
    return accounts;
  }

  function getActiveAccountId() {
    return activeAccountId;
  }

  function getEditingAccountId() {
    return editingAccountId;
  }

  function getActiveAccount() {
    return accounts.find((account) => account.id === activeAccountId) || null;
  }

  function findAccountById(accountId) {
    return accounts.find((item) => item.id === accountId) || null;
  }

  function renderAccountList() {
    accountListController.setState(accounts, activeAccountId);
  }

  function setFormFromAccount(account) {
    const base = defaultsProvider() || {};
    nameInput.value = account?.name || "";
    endpointInput.value = account?.endpoint || "";
    usernameInput.value = account?.username || "";
    passwordInput.value = account?.password || "";
    rootInput.value = account?.rootPath || "/";
    concurrencyInput.value = account?.concurrency ?? base.concurrency ?? 2;
    cacheLimitInput.value = account?.cacheLimitMb ?? base.cacheLimitMb ?? 200;
    autoSyncInput.checked = Boolean(account?.autoSync ?? base.autoSync);
    syncIntervalInput.value = account?.syncIntervalMinutes ?? base.syncIntervalMinutes ?? 30;
    pathInput.value = account?.rootPath || "/";
  }

  function collectAccount(accountId) {
    const base = defaultsProvider() || {};
    const name = nameInput.value.trim();
    return {
      id: accountId || createAccountId(),
      name: name || "",
      endpoint: endpointInput.value.trim(),
      username: usernameInput.value.trim(),
      password: passwordInput.value,
      rootPath: rootInput.value.trim() || "/",
      concurrency: Number(concurrencyInput.value || base.concurrency || 2),
      cacheLimitMb: Number(cacheLimitInput.value || base.cacheLimitMb || 200),
      autoSync: autoSyncInput.checked,
      syncIntervalMinutes: Number(syncIntervalInput.value || base.syncIntervalMinutes || 30)
    };
  }

  async function setActiveAccount(accountId) {
    activeAccountId = accountId;
    await storage.saveActiveAccountId(accountId);
    renderAccountList();
    setFormFromAccount(getActiveAccount());
  }

  async function upsertAccount(account, options = {}) {
    const { setActive = true } = options;
    const index = accounts.findIndex((item) => item.id === account.id);
    if (index >= 0) {
      accounts[index] = account;
    } else {
      accounts.unshift(account);
    }
    await storage.saveAccounts(accounts);
    if (setActive) {
      await setActiveAccount(account.id);
    } else {
      renderAccountList();
    }
  }

  async function moveAccount(accountId, delta) {
    const index = accounts.findIndex((item) => item.id === accountId);
    if (index < 0) {
      return { moved: false };
    }
    const nextIndex = index + (Number(delta) || 0);
    if (nextIndex < 0 || nextIndex >= accounts.length) {
      return { moved: false };
    }
    const next = accounts.slice();
    const temp = next[index];
    next[index] = next[nextIndex];
    next[nextIndex] = temp;
    accounts = next;
    await storage.saveAccounts(accounts);
    renderAccountList();
    return { moved: true };
  }

  async function moveAccountUp(accountId) {
    return await moveAccount(accountId, -1);
  }

  async function moveAccountDown(accountId) {
    return await moveAccount(accountId, 1);
  }

  async function deleteAccount(accountId) {
    const target = findAccountById(accountId);
    if (!target) {
      return { deleted: false };
    }
    const name = getAccountName(target);
    const ok = dialogs?.confirm
      ? await dialogs.confirm({
          title: t?.("dialog.deleteAccount.title") || "删除账号",
          message: t?.("dialog.deleteAccount.message", { name }) || `确定删除账号：${name}？`
        })
      : window.confirm(t?.("dialog.deleteAccount.message", { name }) || `确定删除账号：${name}？`);
    if (!ok) {
      return { deleted: false };
    }
    accounts = accounts.filter((item) => item.id !== accountId);
    await storage.saveAccounts(accounts);
    if (activeAccountId === accountId) {
      activeAccountId = accounts[0]?.id || "";
      await storage.saveActiveAccountId(activeAccountId);
      setFormFromAccount(getActiveAccount());
    }
    renderAccountList();
    return { deleted: true, nextActiveAccountId: activeAccountId };
  }

  function openModal(title, accountId = "") {
    editingAccountId = accountId;
    const account = accountId ? findAccountById(accountId) : null;
    setFormFromAccount(account);
    modalController.open(title);
  }

  function closeModal() {
    modalController.close();
  }

  async function hydrate() {
    accounts = await storage.loadAccounts();
    activeAccountId = await storage.loadActiveAccountId();
    if (!activeAccountId && accounts.length > 0) {
      activeAccountId = accounts[0].id;
      await storage.saveActiveAccountId(activeAccountId);
    }
    renderAccountList();
    setFormFromAccount(getActiveAccount());
    return { accounts, activeAccountId };
  }

  return {
    hydrate,
    getAccounts,
    getActiveAccount,
    getActiveAccountId,
    getEditingAccountId,
    setActiveAccount,
    upsertAccount,
    moveAccountUp,
    moveAccountDown,
    deleteAccount,
    collectAccount,
    setFormFromAccount,
    openModal,
    closeModal,
    findAccountById
  };
}
