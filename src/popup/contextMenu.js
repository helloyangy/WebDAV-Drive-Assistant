export function createContextMenuController(options) {
  const {
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
    onEnter,
    onPreview,
    onDownload,
    onRename,
    onDelete
  } = options;

  let contextItem = null;

  function open(x, y, item) {
    if (!contextMenu) {
      return;
    }

    contextItem = item || null;
    const isDir = Boolean(item?.isDir);

    if (contextMenuEnter) {
      contextMenuEnter.hidden = !isDir;
    }
    if (contextMenuPreview) {
      contextMenuPreview.hidden = isDir;
    }
    if (contextMenuDownload) {
      contextMenuDownload.hidden = isDir;
    }

    contextMenu.style.left = `${Math.max(8, x)}px`;
    contextMenu.style.top = `${Math.max(8, y)}px`;
    contextMenu.setAttribute("aria-hidden", "false");
    contextMenu.classList.add("open");
    queueMicrotask(() => {
      const candidates = Array.from(contextMenu.querySelectorAll('button[role="menuitem"]')).filter(
        (node) => node instanceof HTMLElement && !node.hidden && !node.hasAttribute("disabled")
      );
      const first = candidates[0];
      first?.focus?.();
    });
  }

  function close() {
    if (!contextMenu) {
      return;
    }
    contextMenu.classList.remove("open");
    contextMenu.setAttribute("aria-hidden", "true");
    contextItem = null;
  }

  contextMenuEnter?.addEventListener("click", async () => {
    const item = contextItem;
    close();
    await onEnter(item);
  });

  contextMenuPreview?.addEventListener("click", async () => {
    const item = contextItem;
    close();
    await onPreview(item);
  });

  contextMenuDownload?.addEventListener("click", async () => {
    const item = contextItem;
    close();
    await onDownload(item);
  });

  contextMenuCopyPath?.addEventListener("click", async () => {
    const item = contextItem;
    close();
    if (!item) {
      return;
    }
    const path = relativePathFromHref(item.href);
    const ok = await copyTextToClipboard(path);
    if (ok) {
      setStatus(t?.("common.copied") || "已复制", path);
    } else {
      setStatus(t?.("common.copyFailed") || "复制失败");
    }
  });

  contextMenuRename?.addEventListener("click", async () => {
    const item = contextItem;
    close();
    await onRename(item);
  });

  contextMenuDelete?.addEventListener("click", async () => {
    const item = contextItem;
    close();
    await onDelete(item);
  });

  document.addEventListener("click", (event) => {
    if (!contextMenu?.classList.contains("open")) {
      return;
    }
    const target = event.target;
    if (target instanceof Node && contextMenu.contains(target)) {
      return;
    }
    close();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      close();
    }
  });

  fileList?.addEventListener("scroll", () => {
    close();
  });

  return { open, close };
}
