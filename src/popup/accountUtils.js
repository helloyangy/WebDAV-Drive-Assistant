export function createAccountId() {
  return `acc_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

export function getAccountName(account) {
  if (account?.name) {
    return account.name;
  }
  if (account?.endpoint) {
    return account.endpoint.replace(/^https?:\/\//, "");
  }
  return "未命名";
}

export function getInitial(name) {
  if (!name) {
    return "?";
  }
  return name.trim().slice(0, 1).toUpperCase();
}
