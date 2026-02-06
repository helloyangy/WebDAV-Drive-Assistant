import { encodeBasicAuth, joinPaths } from "./utils.js";

export class WebDavClient {
  constructor(config) {
    this.updateConfig(config);
  }

  updateConfig(config) {
    this.endpoint = config.endpoint || "";
    this.username = config.username || "";
    this.password = config.password || "";
    this.rootPath = config.rootPath || "/";
    this.headers = {
      Authorization: this.username ? encodeBasicAuth(this.username, this.password) : undefined
    };
  }

  buildUrl(path) {
    const normalized = joinPaths(this.rootPath, path);
    if (!this.endpoint.endsWith("/")) {
      return `${this.endpoint}${normalized}`;
    }
    return `${this.endpoint.slice(0, -1)}${normalized}`;
  }

  async request(method, path, body, headers = {}) {
    const url = encodeURI(this.buildUrl(path));
    const mergedHeaders = {
      ...this.headers,
      ...headers
    };
    Object.keys(mergedHeaders).forEach((key) => {
      if (!mergedHeaders[key]) {
        delete mergedHeaders[key];
      }
    });
    const response = await fetch(url, {
      method,
      headers: mergedHeaders,
      body
    });
    if (!response.ok) {
      const contentType = response.headers.get("content-type") || "";
      const text = await response.text();
      const isHtml = contentType.includes("text/html") || contentType.includes("application/xhtml+xml");
      const message = isHtml ? `${response.status} ${response.statusText}` : text || `${response.status} ${response.statusText}`;
      const error = new Error(message);
      error.status = response.status;
      error.raw = text || "";
      throw error;
    }
    return response;
  }

  async list(path = "/") {
    const response = await this.request("PROPFIND", path, null, {
      Depth: "1"
    });
    const text = await response.text();
    return parsePropfindResponse(text, response.url || this.buildUrl(path));
  }

  async get(path) {
    const response = await this.request("GET", path);
    const contentType = response.headers.get("content-type") || "";
    const isHtml = contentType.includes("text/html") || contentType.includes("application/xhtml+xml");
    if (isHtml) {
      const text = await response.text();
      const error = new Error("HTML response");
      error.code = "html_response";
      error.status = response.status || 200;
      error.raw = text || "";
      throw error;
    }
    return response.blob();
  }

  async getByHref(href) {
    const headers = { ...this.headers };
    const candidates = [];
    const raw = String(href || "");
    const decodedXml = decodeXmlEntities(raw);
    candidates.push(encodeURI(decodedXml));
    try {
      candidates.push(encodeURI(decodeURI(decodedXml)));
    } catch {}
    candidates.push(encodeURI(raw));
    const unique = [...new Set(candidates.filter(Boolean))];

    let lastError = null;
    for (const url of unique) {
      try {
        const response = await fetch(url, { method: "GET", headers });
        if (!response.ok) {
          const contentType = response.headers.get("content-type") || "";
          const text = await response.text();
          const isHtml = contentType.includes("text/html") || contentType.includes("application/xhtml+xml");
          const message = isHtml ? `${response.status} ${response.statusText}` : text || `${response.status} ${response.statusText}`;
          const error = new Error(message);
          error.status = response.status;
          error.raw = text || "";
          error.requestUrl = url;
          lastError = error;
          if (response.status === 404) {
            continue;
          }
          throw error;
        }
        const contentType = response.headers.get("content-type") || "";
        const isHtml = contentType.includes("text/html") || contentType.includes("application/xhtml+xml");
        if (isHtml) {
          const text = await response.text();
          const error = new Error("HTML response");
          error.code = "html_response";
          error.status = response.status || 200;
          error.raw = text || "";
          error.requestUrl = url;
          throw error;
        }
        return await response.blob();
      } catch (error) {
        lastError = error;
        if (error?.status === 404) {
          continue;
        }
        break;
      }
    }
    throw lastError || new Error("Request failed");
  }

  async put(path, blob) {
    await this.request("PUT", path, blob, {
      "Content-Type": "application/octet-stream"
    });
  }

  async putStream(path, stream, options = {}) {
    const url = this.buildUrl(path);
    const safeUrl = encodeURI(url);
    const mergedHeaders = {
      ...this.headers,
      "Content-Type": "application/octet-stream",
      ...(options?.headers || {})
    };
    Object.keys(mergedHeaders).forEach((key) => {
      if (!mergedHeaders[key]) {
        delete mergedHeaders[key];
      }
    });
    const response = await fetch(safeUrl, {
      method: "PUT",
      headers: mergedHeaders,
      body: stream,
      signal: options?.signal,
      duplex: "half"
    });
    if (!response.ok) {
      const contentType = response.headers.get("content-type") || "";
      const text = await response.text();
      const isHtml = contentType.includes("text/html") || contentType.includes("application/xhtml+xml");
      const message = isHtml ? `${response.status} ${response.statusText}` : text || `${response.status} ${response.statusText}`;
      const error = new Error(message);
      error.status = response.status;
      error.raw = text || "";
      throw error;
    }
  }

  createPutTask(path, blob, options = {}) {
    const url = this.buildUrl(path);
    const safeUrl = encodeURI(url);
    const onProgress = options?.onProgress;
    const mergedHeaders = {
      ...this.headers,
      "Content-Type": "application/octet-stream"
    };
    Object.keys(mergedHeaders).forEach((key) => {
      if (!mergedHeaders[key]) {
        delete mergedHeaders[key];
      }
    });
    const total = Number(blob?.size || 0) || 0;
    const xhr = new XMLHttpRequest();
    const promise = new Promise((resolve, reject) => {
      xhr.open("PUT", safeUrl, true);
      Object.entries(mergedHeaders).forEach(([key, value]) => {
        try {
          xhr.setRequestHeader(key, value);
        } catch {}
      });
      xhr.upload.onprogress = (event) => {
        if (typeof onProgress !== "function") {
          return;
        }
        const loaded = Number(event?.loaded || 0) || 0;
        const computedTotal = event?.lengthComputable ? Number(event.total || 0) || 0 : total;
        const percent = computedTotal ? Math.min(100, Math.round((loaded / computedTotal) * 100)) : 0;
        try {
          onProgress({ loaded, total: computedTotal, percent });
        } catch {}
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
          return;
        }
        const text = xhr.responseText || "";
        const error = new Error(text || `${xhr.status} ${xhr.statusText}`);
        error.status = xhr.status;
        error.raw = text;
        reject(error);
      };
      xhr.onerror = () => {
        const error = new Error("Network error");
        error.status = 0;
        error.raw = "";
        reject(error);
      };
      xhr.onabort = () => {
        const error = new Error("Aborted");
        error.code = "aborted";
        error.status = 0;
        error.raw = "";
        reject(error);
      };
      xhr.send(blob);
    });
    return {
      promise,
      abort: () => {
        try {
          xhr.abort();
        } catch {}
      }
    };
  }

  async putWithProgress(path, blob, onProgress) {
    const task = this.createPutTask(path, blob, { onProgress });
    await task.promise;
  }

  async delete(path) {
    await this.request("DELETE", path);
  }

  async mkcol(path) {
    await this.request("MKCOL", path);
  }

  async move(source, destination) {
    const url = this.buildUrl(destination);
    const safeUrl = encodeURI(url);
    await this.request("MOVE", source, null, {
      Destination: safeUrl
    });
  }

  async copy(source, destination) {
    const url = this.buildUrl(destination);
    const safeUrl = encodeURI(url);
    await this.request("COPY", source, null, {
      Destination: safeUrl
    });
  }
}

export function parsePropfindResponse(xml, baseHref) {
  const responseRegex = /<(?:[A-Za-z_][\w.-]*:)?response\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?response>/gi;
  const responses = [];
  let match = responseRegex.exec(xml);
  while (match) {
    responses.push(match[1]);
    match = responseRegex.exec(xml);
  }
  if (responses.length === 0) {
    return [];
  }
  const baseKey = normalizeHrefForCompare(baseHref);
  let baseUrl = null;
  try {
    baseUrl = new URL(baseHref);
  } catch {
    baseUrl = null;
  }
  return responses
    .map((block) => {
      const href = extractTagText(block, "href") || "";
      const propBlock = extractTagRaw(block, "prop") || "";
      const resourceTypeBlock = extractTagRaw(propBlock, "resourcetype") || "";
      const contentTypeText = extractTagText(propBlock, "getcontenttype") || "";
      const isCollection =
        /<(?:[A-Za-z_][\w.-]*:)?collection\b[^>]*\/?>/i.test(resourceTypeBlock) ||
        /<(?:[A-Za-z_][\w.-]*:)?collection\b[^>]*\/?>/i.test(block);
      const sizeText = extractTagText(propBlock, "getcontentlength");
      const modifiedText = extractTagText(propBlock, "getlastmodified");
      const etagText = extractTagText(propBlock, "getetag");
      const rawName = href.split("/").filter(Boolean).pop() || "/";
      let name = rawName;
      try {
        name = decodeURIComponent(rawName);
      } catch {}
      const cleanHref = resolveHrefPreserveEncoding(href, baseUrl);
      const isDir =
        isCollection ||
        href.endsWith("/") ||
        cleanHref.endsWith("/") ||
        /directory/i.test(contentTypeText) ||
        /httpd\/unix-directory/i.test(contentTypeText);
      return {
        href: cleanHref,
        name,
        isDir,
        size: sizeText ? Number(sizeText) : null,
        modified: modifiedText || "",
        etag: etagText || ""
      };
    })
    .filter((item) => normalizeHrefForCompare(item.href) !== baseKey);
}

function resolveHrefPreserveEncoding(href, baseUrl) {
  const raw = decodeXmlEntities(String(href || "")).trim();
  if (!raw) {
    return "";
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  if (raw.startsWith("//")) {
    const protocol = baseUrl?.protocol || "https:";
    return `${protocol}${raw}`;
  }
  if (!baseUrl) {
    try {
      return new URL(raw).toString();
    } catch {
      return raw;
    }
  }
  if (raw.startsWith("/")) {
    return `${baseUrl.origin}${raw}`;
  }
  const basePath = baseUrl.pathname || "/";
  const dir = basePath.endsWith("/") ? basePath : `${basePath.slice(0, basePath.lastIndexOf("/") + 1) || "/"}`
  const joined = `${dir}${raw}`.replace(/\/{2,}/g, "/");
  return `${baseUrl.origin}${joined}`;
}

function extractTagRaw(xml, tag) {
  const ns = "(?:[A-Za-z_][\\w.-]*:)?";
  const regex = new RegExp(`<\\s*${ns}${tag}\\b[^>]*>([\\s\\S]*?)<\\/\\s*${ns}${tag}\\s*>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

function extractTagText(xml, tag) {
  return decodeXmlEntities(extractTagRaw(xml, tag));
}

function normalizeHrefForCompare(href) {
  try {
    const url = new URL(href);
    let path = url.pathname || "/";
    if (path.length > 1 && path.endsWith("/")) {
      path = path.slice(0, -1);
    }
    return `${url.origin}${path}`;
  } catch {
    return String(href || "");
  }
}

function decodeXmlEntities(text) {
  const input = String(text || "");
  if (!input.includes("&")) {
    return input;
  }
  return input.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, entity) => {
    if (entity === "amp") return "&";
    if (entity === "lt") return "<";
    if (entity === "gt") return ">";
    if (entity === "quot") return "\"";
    if (entity === "apos") return "'";
    if (entity?.startsWith("#x")) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : `&${entity};`;
    }
    if (entity?.startsWith("#")) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : `&${entity};`;
    }
    return `&${entity};`;
  });
}
