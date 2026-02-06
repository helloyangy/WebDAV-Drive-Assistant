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
    t
  } = options;

  let previewObjectUrl = "";

  function cleanupPreview() {
    if (previewObjectUrl) {
      try {
        URL.revokeObjectURL(previewObjectUrl);
      } catch {}
      previewObjectUrl = "";
    }
    previewContent?.replaceChildren();
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

  async function previewItem(item) {
    if (!item || item.isDir) {
      return;
    }

    cleanupPreview();
    const client = createClientFromActiveAccount();
    setStatus(t?.("common.previewing") || "预览中...");
    try {
      const blob = typeof client.getByHref === "function" ? await client.getByHref(item.href) : await client.get(relativePathFromHref(item.href));
      const type = getPreviewType(item.name, blob.type);
      previewObjectUrl = URL.createObjectURL(blob);

      if (previewContent) {
        if (type === "image") {
          const img = document.createElement("img");
          img.alt = item.name || "";
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
          if (blob.size > 1024 * 1024) {
            const hint = document.createElement("div");
            hint.textContent = t?.("preview.tooLarge") || "文件过大，暂不支持文本预览，请下载查看。";
            previewContent.appendChild(hint);
          } else {
            const text = await blob.text();
            const pre = document.createElement("pre");
            pre.textContent = text;
            previewContent.appendChild(pre);
          }
        } else {
          const hint = document.createElement("div");
          hint.textContent = t?.("preview.unsupported") || "暂不支持预览该格式，请下载查看。";
          previewContent.appendChild(hint);
        }
      }

      modalController.open(item.name || t?.("ui.preview") || "预览");
      setStatus(t?.("common.done") || "完成");
    } catch (error) {
      setStatus("");
      showDownloadError(error?.status ? formatErrorDetail(error) : error?.message || String(error));
      cleanupPreview();
    }
  }

  function bindCleanupOnClose() {
    closeButton?.addEventListener("click", () => {
      cleanupPreview();
    });

    previewModal?.addEventListener("click", (event) => {
      if (event.target === previewModal) {
        cleanupPreview();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && previewModal?.classList.contains("open")) {
        cleanupPreview();
      }
    });
  }

  return {
    previewItem,
    cleanupPreview,
    bindCleanupOnClose
  };
}
