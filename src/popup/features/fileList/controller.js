export function createFileListController(options) {
  const { listElement, getIconPath, formatDate, formatSize, onEnterDir, onPreview, onOpenContextMenu } = options;

  let allItems = [];
  let selectedHref = null;
  let selectedEl = null;
  let itemsByHref = new Map();
  let renderedNodes = [];
  let renderedHrefToIndex = new Map();

  if (listElement) {
    if (!listElement.hasAttribute("role")) {
      listElement.setAttribute("role", "listbox");
    }
    if (!listElement.hasAttribute("aria-label")) {
      listElement.setAttribute("aria-label", "文件列表");
    }
  }

  function getSelectedItem() {
    if (!selectedHref) {
      return null;
    }
    return itemsByHref.get(selectedHref) || null;
  }

  function setItems(items) {
    allItems = Array.isArray(items) ? items.map((item) => ({ ...item, nameLower: String(item?.name || "").toLowerCase() })) : [];
    selectedHref = null;
    selectedEl = null;
    itemsByHref = new Map(allItems.map((item) => [item.href, item]));
  }

  function selectNode(li, href) {
    if (!listElement) {
      return;
    }
    if (!href || !(li instanceof HTMLElement)) {
      return;
    }
    if (selectedEl && selectedEl !== li) {
      selectedEl.classList.remove("selected");
      selectedEl.setAttribute("aria-selected", "false");
    }
    selectedEl = li;
    selectedHref = href;
    li.classList.add("selected");
    li.setAttribute("aria-selected", "true");
  }

  async function openItem(item) {
    if (!item) {
      return;
    }
    if (item.isDir) {
      await onEnterDir(item);
    } else {
      await onPreview(item);
    }
  }

  function render(items) {
    if (!listElement) {
      return;
    }
    const fragment = document.createDocumentFragment();
    renderedNodes = [];
    renderedHrefToIndex = new Map();
    for (const item of items) {
      const li = document.createElement("li");
      li.tabIndex = 0;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", "false");
      const row = document.createElement("div");
      row.className = "file-row";
      const icon = document.createElement("div");
      icon.className = "file-icon";
      const img = document.createElement("img");
      img.alt = "";
      img.setAttribute("aria-hidden", "true");
      img.src = getIconPath(item);
      icon.appendChild(img);

      const text = document.createElement("div");
      text.className = "file-text";
      const title = document.createElement("div");
      title.className = "file-title";
      title.textContent = item.isDir ? `${item.name}/` : item.name;
      const meta = document.createElement("div");
      meta.className = "file-meta";
      meta.textContent = item.isDir ? "目录" : `${formatSize(item.size)} ${formatDate(item.modified)}`;
      text.appendChild(title);
      text.appendChild(meta);

      row.appendChild(icon);
      row.appendChild(text);
      li.appendChild(row);

      li.setAttribute("data-href", item.href);
      renderedHrefToIndex.set(item.href, renderedNodes.length);
      renderedNodes.push(li);
      fragment.appendChild(li);
    }
    listElement.replaceChildren(fragment);
    selectedEl = null;
    selectedHref = null;
  }

  function applyFilter(keyword) {
    const lower = String(keyword || "").trim().toLowerCase();
    const filtered = lower
      ? allItems.filter((item) => (item.nameLower || "").includes(lower))
      : allItems;
    render(filtered);
    return { total: allItems.length, shown: filtered.length, keyword: lower };
  }

  function getLiFromEvent(event) {
    const target = event?.target;
    if (!(target instanceof Element) || !listElement) {
      return null;
    }
    const li = target.closest("li[data-href]");
    if (!(li instanceof HTMLElement) || !listElement.contains(li)) {
      return null;
    }
    return li;
  }

  function getItemFromLi(li) {
    const href = li?.getAttribute("data-href") || "";
    if (!href) {
      return null;
    }
    return itemsByHref.get(href) || null;
  }

  if (listElement) {
    listElement.addEventListener("click", (event) => {
      const li = getLiFromEvent(event);
      if (!li) {
        return;
      }
      const href = li.getAttribute("data-href") || "";
      selectNode(li, href);
    });

    listElement.addEventListener("dblclick", async (event) => {
      const li = getLiFromEvent(event);
      if (!li) {
        return;
      }
      const item = getItemFromLi(li);
      if (!item) {
        return;
      }
      selectNode(li, item.href);
      await openItem(item);
    });

    listElement.addEventListener("contextmenu", (event) => {
      const li = getLiFromEvent(event);
      if (!li) {
        return;
      }
      event.preventDefault();
      const item = getItemFromLi(li);
      if (!item) {
        return;
      }
      selectNode(li, item.href);
      onOpenContextMenu(event.clientX, event.clientY, item);
    });

    listElement.addEventListener("keydown", async (event) => {
      const li = getLiFromEvent(event);
      if (!li) {
        return;
      }
      const href = li.getAttribute("data-href") || "";
      const item = getItemFromLi(li);
      if (event.key === "Enter") {
        event.preventDefault();
        selectNode(li, href);
        await openItem(item);
        return;
      }
      if (event.key === " ") {
        event.preventDefault();
        selectNode(li, href);
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const idx = renderedHrefToIndex.get(href);
        if (typeof idx !== "number") {
          return;
        }
        const nextIdx = event.key === "ArrowDown" ? Math.min(renderedNodes.length - 1, idx + 1) : Math.max(0, idx - 1);
        const nextNode = renderedNodes[nextIdx];
        if (!(nextNode instanceof HTMLElement) || nextNode === li) {
          return;
        }
        nextNode.focus();
        const nextHref = nextNode.getAttribute("data-href") || "";
        if (nextHref) {
          selectNode(nextNode, nextHref);
        }
      }
    });
  }

  return {
    setItems,
    applyFilter,
    getSelectedItem
  };
}
