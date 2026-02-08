import { getAccountName, getInitial } from "./accountUtils.js";

export function createAccountListController(options) {
  const { listElement, searchInput, onSelectAccount, onEditAccount, onConnectAccount, onMoveUp, onMoveDown, onDeleteAccount, t } = options;
  let accounts = [];
  let activeAccountId = "";

  function closeAllMenus() {
    document.querySelectorAll(".account-menu.open").forEach((menu) => {
      menu.classList.remove("open");
    });
  }

  function toggleMenu(menu) {
    const isOpen = menu.classList.contains("open");
    closeAllMenus();
    if (!isOpen) {
      menu.classList.add("open");
    }
  }

  function render() {
    listElement.innerHTML = "";
    const keyword = searchInput?.value?.trim().toLowerCase() || "";
    const filtered = accounts.filter((account) => {
      if (!keyword) {
        return true;
      }
      const text = `${account.name || ""} ${account.endpoint || ""}`.toLowerCase();
      return text.includes(keyword);
    });
    if (filtered.length === 0) {
      const empty = document.createElement("li");
      empty.className = "muted";
      empty.textContent = t?.("ui.accountList.empty") || "暂无账号";
      listElement.appendChild(empty);
      return;
    }
    for (const account of filtered) {
      const item = document.createElement("li");
      if (account.id === activeAccountId) {
        item.classList.add("active");
      }
      const icon = document.createElement("span");
      icon.className = "account-icon";
      const name = getAccountName(account);
      icon.textContent = getInitial(name);
      const label = document.createElement("span");
      label.className = "account-name";
      label.textContent = name;
      const actions = document.createElement("span");
      actions.className = "account-actions";
      const menuBtn = document.createElement("button");
      menuBtn.type = "button";
      menuBtn.className = "icon-button ghost";
      menuBtn.textContent = "⋯";
      const menu = document.createElement("div");
      menu.className = "account-menu";
      const index = accounts.findIndex((a) => a.id === account.id);
      const canMoveUp = index > 0;
      const canMoveDown = index >= 0 && index < accounts.length - 1;
      const editItem = document.createElement("button");
      editItem.type = "button";
      editItem.textContent = t?.("ui.edit") || "编辑";
      editItem.addEventListener("click", (event) => {
        event.stopPropagation();
        closeAllMenus();
        onEditAccount(account);
      });
      const connectItem = document.createElement("button");
      connectItem.type = "button";
      connectItem.textContent = t?.("ui.connect") || "连接";
      connectItem.addEventListener("click", async (event) => {
        event.stopPropagation();
        closeAllMenus();
        await onConnectAccount(account);
      });
      const moveUpItem = document.createElement("button");
      moveUpItem.type = "button";
      moveUpItem.disabled = !canMoveUp || typeof onMoveUp !== "function";
      moveUpItem.textContent = t?.("ui.moveUp") || "上移";
      moveUpItem.addEventListener("click", async (event) => {
        event.stopPropagation();
        closeAllMenus();
        if (typeof onMoveUp === "function") {
          await onMoveUp(account);
        }
      });
      const moveDownItem = document.createElement("button");
      moveDownItem.type = "button";
      moveDownItem.disabled = !canMoveDown || typeof onMoveDown !== "function";
      moveDownItem.textContent = t?.("ui.moveDown") || "下移";
      moveDownItem.addEventListener("click", async (event) => {
        event.stopPropagation();
        closeAllMenus();
        if (typeof onMoveDown === "function") {
          await onMoveDown(account);
        }
      });
      const deleteItem = document.createElement("button");
      deleteItem.type = "button";
      deleteItem.className = "danger";
      deleteItem.textContent = t?.("ui.delete") || "删除";
      deleteItem.addEventListener("click", async (event) => {
        event.stopPropagation();
        closeAllMenus();
        await onDeleteAccount(account);
      });
      menu.appendChild(editItem);
      menu.appendChild(connectItem);
      menu.appendChild(moveUpItem);
      menu.appendChild(moveDownItem);
      menu.appendChild(deleteItem);
      menuBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleMenu(menu);
      });
      item.appendChild(icon);
      item.appendChild(label);
      actions.appendChild(menuBtn);
      item.appendChild(actions);
      item.appendChild(menu);
      item.addEventListener("click", async () => {
        closeAllMenus();
        await onSelectAccount(account);
      });
      listElement.appendChild(item);
    }
  }

  function setAccounts(next) {
    accounts = next || [];
    render();
  }

  function setActiveAccountId(next) {
    activeAccountId = next || "";
    render();
  }

  function setState(nextAccounts, nextActiveId) {
    accounts = nextAccounts || [];
    activeAccountId = nextActiveId || "";
    render();
  }

  searchInput?.addEventListener("input", () => {
    render();
  });

  document.addEventListener("click", () => {
    closeAllMenus();
  });

  return {
    setAccounts,
    setActiveAccountId,
    setState,
    render,
    closeAllMenus
  };
}
