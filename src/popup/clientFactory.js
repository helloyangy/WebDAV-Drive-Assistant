export function createClientFactory(options) {
  const { WebDavClient, getActiveAccount, endpointInput, usernameInput, passwordInput, rootInput } = options;

  function getActiveClientConfig() {
    const account = getActiveAccount() || {};
    return {
      endpoint: (account.endpoint || endpointInput.value || "").trim(),
      username: (account.username || usernameInput.value || "").trim(),
      password: account.password ?? passwordInput.value ?? "",
      rootPath: (account.rootPath || rootInput.value || "/").trim() || "/"
    };
  }

  function createClientFromActiveAccount() {
    return new WebDavClient(getActiveClientConfig());
  }

  return {
    getActiveClientConfig,
    createClientFromActiveAccount
  };
}
