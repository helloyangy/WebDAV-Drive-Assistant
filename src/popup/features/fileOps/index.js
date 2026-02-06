import { normalizePath } from "../../../utils.js";

export function createFileOps(options) {
  const { sendMessage, clientFactory, relativePathFromHref } = options;

  async function list(path) {
    const response = await sendMessage({ type: "list", path });
    return response?.items || [];
  }

  function upload(path, file, options = {}) {
    const client = clientFactory.createClientFromActiveAccount();
    const onProgress = options?.onProgress;
    if (typeof onProgress === "function" && typeof client.createPutTask === "function") {
      return client.createPutTask(path, file, { onProgress });
    }
    return { promise: client.put(path, file), abort: null };
  }

  async function mkdir(path) {
    await sendMessage({ type: "mkdir", path });
  }

  async function removeByHref(href) {
    const path = relativePathFromHref(href);
    await sendMessage({ type: "delete", path });
  }

  async function downloadByHref(href, filename) {
    const client = clientFactory.createClientFromActiveAccount();
    const blob = typeof client.getByHref === "function" ? await client.getByHref(href) : await client.get(relativePathFromHref(href));
    const url = URL.createObjectURL(blob);
    await new Promise((resolve, reject) => {
      chrome.downloads.download({ url, filename, saveAs: true }, (downloadId) => {
        const lastError = chrome?.runtime?.lastError;
        if (lastError) {
          reject(new Error(lastError.message || "下载失败"));
          return;
        }
        if (!downloadId) {
          reject(new Error("下载失败"));
          return;
        }
        resolve(downloadId);
      });
    }).finally(() => {
      setTimeout(() => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      }, 30_000);
    });
  }

  async function renameByHref(href, nextName, isDir = false) {
    const source = relativePathFromHref(href);
    const parts = String(source || "/")
      .split("/")
      .filter(Boolean);
    parts.pop();
    const parent = parts.length ? `/${parts.join("/")}` : "/";
    const base = normalizePath(`${parent}/${nextName}`);
    const destination = isDir ? (base.endsWith("/") ? base : `${base}/`) : base;
    const client = clientFactory.createClientFromActiveAccount();
    await client.move(source, destination);
  }

  return {
    list,
    upload,
    mkdir,
    removeByHref,
    downloadByHref,
    renameByHref
  };
}
