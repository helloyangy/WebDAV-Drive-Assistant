export function createPreviewController(options) {
  const {
    previewModal,
    previewContent,
    modalController,
    closeButton,
    setStatus,
    showDownloadError,
    createClientFromActiveAccount,
    relativePathFromHref,
    formatErrorDetail,
    formatSize,
    t,
    onBackgroundStateChange
  } = options;

  let previewObjectUrl = "";
  let activeTask = null;
  let activeItem = null;
  let activeBlob = null;
  let lastError = null;
  let latestProgress = { loaded: 0, total: 0 };
  let activeLoadingUi = null;
  let previewToken = 0;

  function emitBackgroundState() {
    if (typeof onBackgroundStateChange !== "function") {
      return;
    }
    const modalOpen = Boolean(previewModal?.classList?.contains?.("open"));
    const hasTask = Boolean(activeTask);
    const hasBlob = Boolean(activeBlob);
    const visible = !modalOpen && Boolean(activeItem) && (hasTask || hasBlob);
    const state = hasBlob ? "ready" : hasTask ? "loading" : "none";
    const name = activeItem?.name || "";
    try {
      onBackgroundStateChange({ visible, state, name });
    } catch {}
  }

  function cleanupPreviewUi() {
    if (previewObjectUrl) {
      try {
        URL.revokeObjectURL(previewObjectUrl);
      } catch {}
      previewObjectUrl = "";
    }
    previewContent?.replaceChildren();
    activeLoadingUi = null;
  }

  function abortLoading() {
    if (activeTask?.abort) {
      try {
        activeTask.abort();
      } catch {}
    }
    activeTask = null;
    activeItem = null;
    activeBlob = null;
    lastError = null;
    latestProgress = { loaded: 0, total: 0 };
    activeLoadingUi = null;
    setStatus("");
    emitBackgroundState();
  }

  function getPreviewType(name, mime) {
    const lower = (name || "").toLowerCase();
    const ext = lower.includes(".") ? lower.split(".").pop() : "";
    const normalizedMime = String(mime || "").toLowerCase();

    const imageExts = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"]);
    if (normalizedMime.startsWith("image/") || imageExts.has(ext)) {
      return "image";
    }
    if (normalizedMime.startsWith("video/") || ext === "mp4") {
      return "video";
    }

    const textExts = new Set(["txt", "log", "md", "json", "js", "ts", "css", "html", "xml", "yml", "yaml"]);
    if (normalizedMime.startsWith("text/") || textExts.has(ext)) {
      return "text";
    }

    if (normalizedMime === "application/pdf" || ext === "pdf") {
      return "pdf";
    }
    return "unknown";
  }

  function renderLoading(item, message) {
    if (!previewContent) {
      return { setProgress: () => {}, setMessage: () => {} };
    }
    previewContent.replaceChildren();

    const container = document.createElement("div");
    container.className = "preview-loading upload-detail";

    const title = document.createElement("div");
    title.className = "upload-file-name";
    title.textContent = message || t?.("preview.loading") || t?.("common.loading") || "加载中...";

    const desc = document.createElement("div");
    desc.className = "preview-loading-desc";
    const sizeThreshold = 20 * 1024 * 1024;
    const sizeText = typeof item?.size === "number" && item.size >= sizeThreshold ? formatSize?.(item.size) || `${item.size} B` : "";
    desc.textContent = sizeText ? t?.("preview.largeHint", { size: sizeText }) || `文件较大（${sizeText}），预览可能需要较长时间，可随时取消。` : "";

    const track = document.createElement("div");
    track.className = "upload-progress-track";
    track.setAttribute("aria-hidden", "true");
    const bar = document.createElement("div");
    bar.className = "upload-progress-bar";
    track.appendChild(bar);

    const stats = document.createElement("div");
    stats.className = "upload-progress-text";
    stats.textContent = "";

    const btnRow = document.createElement("div");
    btnRow.className = "button-row";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = t?.("preview.cancelLoad") || t?.("common.cancel") || "取消";
    cancelBtn.style.gridColumn = "1 / -1";
    cancelBtn.addEventListener("click", () => {
      abortLoading();
      cleanupPreviewUi();
      modalController.close();
      setStatus(t?.("preview.canceled") || "");
    });
    btnRow.appendChild(cancelBtn);

    container.appendChild(title);
    if (desc.textContent) {
      container.appendChild(desc);
    }
    container.appendChild(track);
    container.appendChild(stats);
    container.appendChild(btnRow);

    previewContent.appendChild(container);

    function setProgress(loaded, total) {
      const safeLoaded = Math.max(0, Number(loaded) || 0);
      const safeTotal = Math.max(0, Number(total) || 0);
      if (safeTotal) {
        track.classList.remove("indeterminate");
        const percent = Math.min(100, Math.round((safeLoaded / safeTotal) * 100));
        bar.style.width = `${percent}%`;
      } else {
        track.classList.add("indeterminate");
      }
      const loadedText = formatSize?.(safeLoaded) || `${safeLoaded} B`;
      if (safeTotal) {
        const totalText = formatSize?.(safeTotal) || `${safeTotal} B`;
        stats.textContent = t?.("preview.loadedOfTotal", { loaded: loadedText, total: totalText }) || `已加载 ${loadedText} / ${totalText}`;
      } else {
        stats.textContent = t?.("preview.loaded", { loaded: loadedText }) || `已加载 ${loadedText}`;
      }
    }

    function setMessage(text) {
      title.textContent = String(text || "");
    }

    const api = { setProgress, setMessage };
    activeLoadingUi = api;
    return api;
  }

  function renderPreview(item, blob) {
    if (!previewContent) {
      return;
    }
    previewContent.replaceChildren();
    const type = getPreviewType(item?.name, blob?.type);
    previewObjectUrl = URL.createObjectURL(blob);

    if (type === "image") {
      const img = document.createElement("img");
      img.alt = item?.name || "";
      img.src = previewObjectUrl;
      previewContent.appendChild(img);
    } else if (type === "video") {
      const video = document.createElement("video");
      video.controls = true;
      video.src = previewObjectUrl;
      video.playsInline = true;
      previewContent.appendChild(video);
    } else if (type === "pdf") {
      const iframe = document.createElement("iframe");
      iframe.src = previewObjectUrl;
      iframe.style.width = "100%";
      iframe.style.height = "70vh";
      iframe.style.border = "none";
      previewContent.appendChild(iframe);
    } else if (type === "text") {
      if ((blob?.size || 0) > 1024 * 1024) {
        const hint = document.createElement("div");
        hint.textContent = t?.("preview.tooLarge") || "文件过大，暂不支持文本预览，请下载查看。";
        previewContent.appendChild(hint);
      } else {
        blob
          .text()
          .then((text) => {
            if (!previewContent || !previewModal?.classList.contains("open")) {
              return;
            }
            const pre = document.createElement("pre");
            pre.textContent = text;
            previewContent.replaceChildren(pre);
          })
          .catch(() => {});
      }
    } else {
      const hint = document.createElement("div");
      hint.textContent = t?.("preview.unsupported") || "暂不支持预览该格式，请下载查看。";
      previewContent.appendChild(hint);
    }
  }

  function openProgress() {
    if (!activeItem) {
      return;
    }
    modalController.open(activeItem.name || t?.("ui.preview") || "预览");
    emitBackgroundState();
    if (activeBlob) {
      cleanupPreviewUi();
      renderPreview(activeItem, activeBlob);
      setStatus("");
      return;
    }
    if (activeTask) {
      const ui = renderLoading(activeItem, t?.("preview.loading") || t?.("common.loading") || "加载中...");
      ui.setProgress(latestProgress.loaded, latestProgress.total);
      setStatus("");
      return;
    }
    if (lastError) {
      showDownloadError(lastError?.status ? formatErrorDetail(lastError) : lastError?.message || String(lastError));
      cleanupPreviewUi();
    }
  }

  async function previewItem(item) {
    if (!item || item.isDir) {
      return;
    }

    abortLoading();
    cleanupPreviewUi();
    const client = createClientFromActiveAccount();
    const token = (previewToken += 1);
    activeItem = item;
    lastError = null;
    activeBlob = null;
    latestProgress = { loaded: 0, total: typeof item?.size === "number" ? item.size : 0 };
    modalController.open(item.name || t?.("ui.preview") || "预览");
    renderLoading(item, t?.("preview.loading") || "正在加载预览内容...");
    setStatus(t?.("common.previewing") || "预览中...");
    emitBackgroundState();
    try {
      const totalHint = typeof item?.size === "number" ? item.size : 0;
      if (typeof client.createGetTaskByHref === "function") {
        activeTask = client.createGetTaskByHref(item.href, {
          onProgress: (p) => {
            if (token !== previewToken) {
              return;
            }
            const loaded = Number(p?.loaded || 0) || 0;
            const total = Number(p?.total || 0) || totalHint || 0;
            latestProgress = { loaded, total };
            activeLoadingUi?.setProgress(loaded, total);
            if (!previewModal?.classList.contains("open")) {
              setStatus(t?.("preview.backgroundLoading") || "预览加载中...");
              emitBackgroundState();
            }
          }
        });
      } else {
        activeTask = null;
      }
      emitBackgroundState();
      const blob = activeTask
        ? await activeTask.promise
        : typeof client.getByHref === "function"
          ? await client.getByHref(item.href)
          : await client.get(relativePathFromHref(item.href));
      if (token !== previewToken) {
        return;
      }
      activeTask = null;
      activeBlob = blob;
      latestProgress = { loaded: blob?.size || latestProgress.loaded || 0, total: latestProgress.total || blob?.size || 0 };
      if (!previewModal?.classList.contains("open")) {
        setStatus(t?.("preview.backgroundReady") || "预览已就绪");
        emitBackgroundState();
        return;
      }
      cleanupPreviewUi();
      renderPreview(item, blob);
      setStatus("");
      emitBackgroundState();
    } catch (error) {
      lastError = error;
      if (error?.code === "aborted") {
        setStatus(t?.("preview.canceled") || "");
        emitBackgroundState();
        return;
      }
      setStatus("");
      showDownloadError(error?.status ? formatErrorDetail(error) : error?.message || String(error));
      abortLoading();
      cleanupPreviewUi();
    }
  }

  function bindCleanupOnClose() {
    closeButton?.addEventListener("click", () => {
      cleanupPreviewUi();
      if (activeTask && activeItem && !activeBlob) {
        setStatus(t?.("preview.backgroundLoading") || "预览加载中...");
      } else if (activeBlob && activeItem) {
        setStatus(t?.("preview.backgroundReady") || "预览已就绪");
      }
      emitBackgroundState();
    });

    previewModal?.addEventListener("click", (event) => {
      if (event.target === previewModal) {
        cleanupPreviewUi();
        if (activeTask && activeItem && !activeBlob) {
          setStatus(t?.("preview.backgroundLoading") || "预览加载中...");
        } else if (activeBlob && activeItem) {
          setStatus(t?.("preview.backgroundReady") || "预览已就绪");
        }
        emitBackgroundState();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && previewModal?.classList.contains("open")) {
        cleanupPreviewUi();
        if (activeTask && activeItem && !activeBlob) {
          setStatus(t?.("preview.backgroundLoading") || "预览加载中...");
        } else if (activeBlob && activeItem) {
          setStatus(t?.("preview.backgroundReady") || "预览已就绪");
        }
        emitBackgroundState();
      }
    });
  }

  return {
    previewItem,
    cleanupPreview: cleanupPreviewUi,
    bindCleanupOnClose,
    openProgress,
    hasBackgroundPreview: () => Boolean(activeItem && (activeTask || activeBlob))
  };
}
