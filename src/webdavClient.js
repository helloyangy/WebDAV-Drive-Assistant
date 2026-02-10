import { AuthManager } from "./auth/index.js";
import { encodeUrlForRequest, joinPaths } from "./utils.js";
import { logDebug } from "./logger.js";

const MAX_PROPFIND_XML_CHARS = 5_000_000;
const MAX_XML_FRAGMENT_CHARS = 500_000;
const DIGEST_SEED_PREFIX = "webdav_digest_challenge:";

function getOrigin(endpoint) {
  try {
    return new URL(String(endpoint || "")).origin;
  } catch {
    return "";
  }
}

function getDigestSeedKey(endpoint, username) {
  const origin = getOrigin(endpoint);
  const user = String(username || "");
  if (!origin || !user) {
    return "";
  }
  return `${DIGEST_SEED_PREFIX}${origin}:${encodeURIComponent(user)}`;
}

async function loadDigestSeed(endpoint, username) {
  const key = getDigestSeedKey(endpoint, username);
  if (!key || !globalThis?.chrome?.storage?.session?.get) {
    return null;
  }
  try {
    const obj = await chrome.storage.session.get(key);
    return obj?.[key] || null;
  } catch {
    return null;
  }
}

async function saveDigestSeed(endpoint, username, seed) {
  const key = getDigestSeedKey(endpoint, username);
  if (!key || !globalThis?.chrome?.storage?.session?.set) {
    return;
  }
  try {
    await chrome.storage.session.set({ [key]: seed });
  } catch {}
}

export class WebDavClient {
  constructor(config) {
    this.updateConfig(config);
  }

  updateConfig(config) {
    this.endpoint = config.endpoint || "";
    this.username = config.username || "";
    this.password = config.password || "";
    this.rootPath = config.rootPath || "/";
    if (this.auth) {
      this.auth.updateConfig({ ...config, endpoint: this.endpoint, username: this.username, password: this.password });
    } else {
      this.auth = new AuthManager({ ...config, endpoint: this.endpoint, username: this.username, password: this.password });
    }
  }

  buildUrl(path) {
    const normalized = joinPaths(this.rootPath, path);
    if (!this.endpoint.endsWith("/")) {
      return `${this.endpoint}${normalized}`;
    }
    return `${this.endpoint.slice(0, -1)}${normalized}`;
  }

  async request(method, path, body, headers = {}) {
    const url = encodeUrlForRequest(this.buildUrl(path));
    const mergedHeaders = {
      ...headers
    };
    Object.keys(mergedHeaders).forEach((key) => {
      if (!mergedHeaders[key]) {
        delete mergedHeaders[key];
      }
    });
    const response = await this._fetchWithAuth(url, {
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
      error.raw = text && text.length > 200_000 ? `${text.slice(0, 200_000)}…` : text || "";
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
    const candidates = [];
    const raw = String(href || "");
    const decodedXml = decodeXmlEntities(raw);
    candidates.push(encodeUrlForRequest(decodedXml));
    try {
      candidates.push(encodeUrlForRequest(decodeURI(decodedXml)));
    } catch {}
    candidates.push(encodeUrlForRequest(raw));
    const unique = [...new Set(candidates.filter(Boolean))];

    let lastError = null;
    for (const url of unique) {
      try {
        const response = await this._fetchWithAuth(url, { method: "GET", headers: {} });
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

  createGetTaskByHref(href, options = {}) {
    const onProgress = options?.onProgress;
    const abortController = new AbortController();

    const candidates = [];
    const raw = String(href || "");
    const decodedXml = decodeXmlEntities(raw);
    candidates.push(encodeUrlForRequest(decodedXml));
    try {
      candidates.push(encodeUrlForRequest(decodeURI(decodedXml)));
    } catch {}
    candidates.push(encodeUrlForRequest(raw));
    const unique = [...new Set(candidates.filter(Boolean))];

    const promise = (async () => {
      let lastError = null;
      for (const url of unique) {
        try {
          const response = await this._fetchWithAuth(url, { method: "GET", headers: {}, signal: abortController.signal });
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

          const lenHeader = response.headers.get("content-length") || "";
          const total = lenHeader ? Number(lenHeader) : 0;

          if (!response.body || typeof response.body.getReader !== "function") {
            const blob = await response.blob();
            if (typeof onProgress === "function") {
              try {
                onProgress({ loaded: blob.size || 0, total: total || blob.size || 0, percent: 100 });
              } catch {}
            }
            return blob;
          }

          const reader = response.body.getReader();
          const chunks = [];
          let loaded = 0;
          while (true) {
            const result = await reader.read();
            if (result.done) {
              break;
            }
            const value = result.value;
            if (value) {
              chunks.push(value);
              loaded += value.byteLength || 0;
              if (typeof onProgress === "function") {
                const computedTotal = total || 0;
                const percent = computedTotal ? Math.min(100, Math.round((loaded / computedTotal) * 100)) : 0;
                try {
                  onProgress({ loaded, total: computedTotal, percent });
                } catch {}
              }
            }
          }
          return new Blob(chunks, { type: contentType || "application/octet-stream" });
        } catch (error) {
          if (error?.name === "AbortError") {
            const aborted = new Error("Aborted");
            aborted.code = "aborted";
            aborted.status = 0;
            aborted.raw = "";
            throw aborted;
          }
          lastError = error;
          if (error?.status === 404) {
            continue;
          }
          break;
        }
      }
      throw lastError || new Error("Request failed");
    })();

    return {
      promise,
      abort: () => {
        try {
          abortController.abort();
        } catch {}
      }
    };
  }

  async deleteByHref(href) {
    const candidates = [];
    const raw = String(href || "");
    const decodedXml = decodeXmlEntities(raw);
    candidates.push(encodeUrlForRequest(decodedXml));
    try {
      candidates.push(encodeUrlForRequest(decodeURI(decodedXml)));
    } catch {}
    candidates.push(encodeUrlForRequest(raw));
    const unique = [...new Set(candidates.filter(Boolean))];

    let lastError = null;
    for (const url of unique) {
      try {
        const response = await this._fetchWithAuth(url, { method: "DELETE", headers: {} });
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
        return;
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

  async moveByHref(href, nextName, isDir = false) {
    const candidates = [];
    const raw = String(href || "");
    const decodedXml = decodeXmlEntities(raw);
    candidates.push(encodeUrlForRequest(decodedXml));
    try {
      candidates.push(encodeUrlForRequest(decodeURI(decodedXml)));
    } catch {}
    candidates.push(encodeUrlForRequest(raw));
    const unique = [...new Set(candidates.filter(Boolean))];

    const safeName = String(nextName || "").trim();
    if (!safeName) {
      throw new Error("Invalid name");
    }
    if (safeName.includes("/") || safeName.includes("\\")) {
      throw new Error("Invalid name");
    }

    const attemptMove = async (sourceUrl, destination, meta = {}) => {
      const response = await this._fetchWithAuth(sourceUrl, {
        method: "MOVE",
        headers: {
          Destination: destination,
          Overwrite: "T"
        }
      });
      if (response.ok) {
        return;
      }
      const contentType = response.headers.get("content-type") || "";
      const text = await response.text();
      const isHtml = contentType.includes("text/html") || contentType.includes("application/xhtml+xml");
      const message = isHtml ? `${response.status} ${response.statusText}` : text || `${response.status} ${response.statusText}`;
      const error = new Error(message);
      error.status = response.status;
      error.raw = text || "";
      Object.assign(error, meta);
      throw error;
    };

    let lastError = null;
    for (const url of unique) {
      let parsed = null;
      try {
        parsed = new URL(url);
      } catch {
        parsed = null;
      }
      if (!parsed) {
        continue;
      }

      const pathname = parsed.pathname || "/";
      const withoutTrailing = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
      const cut = withoutTrailing.lastIndexOf("/");
      const parent = cut >= 0 ? withoutTrailing.slice(0, cut + 1) : "/";

      const rawBase = `${parent}${safeName}`.replace(/\/{2,}/g, "/");
      const encodedBase = `${parent}${encodeURIComponent(safeName)}`.replace(/\/{2,}/g, "/");
      const rawPaths = isDir ? [`${rawBase}/`, rawBase] : [rawBase];
      const encodedPaths = isDir ? [`${encodedBase}/`, encodedBase] : [encodedBase];

      const rawDestinations = rawPaths.flatMap((p) => [`${parsed.origin}${p}`, p]);
      const encodedDestinations = encodedPaths.flatMap((p) => [`${parsed.origin}${p}`, `${parsed.origin}${encodeUrlForRequest(p)}`, p]);

      for (const destination of rawDestinations) {
        try {
          await attemptMove(url, destination, { requestUrl: url, destinationUrl: destination });
          return;
        } catch (error) {
          lastError = error;
          continue;
        }
      }

      for (let i = 0; i < encodedPaths.length; i += 1) {
        const encodedPath = encodedPaths[i];
        const encodedAbs = `${parsed.origin}${encodedPath}`;
        for (const destination of encodedDestinations) {
          try {
            await attemptMove(url, destination, { requestUrl: url, destinationUrl: destination });
            try {
              const doubleEncodedPath = encodedPath.replace(/%/g, "%25");
              const doubleEncodedUrl = `${parsed.origin}${doubleEncodedPath}`;
              const preferredRaw = rawPaths[i] || rawBase;
              const fixDestinations = [`${parsed.origin}${preferredRaw}`, preferredRaw];
              for (const fixDestination of fixDestinations) {
                try {
                  await attemptMove(doubleEncodedUrl, fixDestination, {
                    requestUrl: doubleEncodedUrl,
                    destinationUrl: fixDestination
                  });
                  break;
                } catch {}
              }
            } catch {}
            return;
          } catch (error) {
            lastError = error;
            continue;
          }
        }
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
    const safeUrl = encodeUrlForRequest(url);
    await this._ensureDigestChallengeForNonRetryableBody();
    const mergedHeaders = {
      "Content-Type": "application/octet-stream",
      ...(options?.headers || {})
    };
    Object.keys(mergedHeaders).forEach((key) => {
      if (!mergedHeaders[key]) {
        delete mergedHeaders[key];
      }
    });
    const response = await this._fetchWithAuth(safeUrl, {
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
    const safeUrl = encodeUrlForRequest(url);
    const onProgress = options?.onProgress;
    const mergedHeaders = {
      "Content-Type": "application/octet-stream"
    };
    Object.keys(mergedHeaders).forEach((key) => {
      if (!mergedHeaders[key]) {
        delete mergedHeaders[key];
      }
    });
    const total = Number(blob?.size || 0) || 0;
    let activeXhr = null;
    let aborted = false;
    const promise = new Promise((resolve, reject) => {
      const sendAttempt = async (attempt) => {
        await this._seedDigestChallengeFromSession();
        if (aborted) {
          const error = new Error("Aborted");
          error.code = "aborted";
          error.status = 0;
          error.raw = "";
          throw error;
        }
        const xhr = new XMLHttpRequest();
        activeXhr = xhr;
        xhr.open("PUT", safeUrl, true);
        const headers = { ...mergedHeaders, ...(options?.headers || {}) };
        Object.keys(headers).forEach((key) => {
          if (!headers[key]) {
            delete headers[key];
          }
        });
        const authHeader = await this.auth.getPreemptiveAuthorization("PUT", safeUrl, blob);
        if (authHeader && !headers.Authorization) {
          headers.Authorization = authHeader;
        }
        Object.entries(headers).forEach(([key, value]) => {
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
        const result = await new Promise((innerResolve, innerReject) => {
          xhr.onload = () => innerResolve({ status: xhr.status, statusText: xhr.statusText, text: xhr.responseText || "", xhr });
          xhr.onerror = () => innerReject(new Error("Network error"));
          xhr.onabort = () => {
            const error = new Error("Aborted");
            error.code = "aborted";
            error.status = 0;
            error.raw = "";
            innerReject(error);
          };
          xhr.send(blob);
        });
        if (result.status >= 200 && result.status < 300) {
          return;
        }
        if (result.status === 401 && attempt === 0 && this.auth.canUseDigest()) {
          const www = result.xhr?.getResponseHeader?.("www-authenticate") || "";
          const parsed = this.auth.observeUnauthorized({ headers: { get: () => www } });
          if (parsed) {
            await saveDigestSeed(this.endpoint, this.username, parsed);
          }
          const digestAuth = await this.auth.getDigestAuthorization("PUT", safeUrl, blob);
          if (digestAuth) {
            return await sendAttempt(1);
          }
        }
        const error = new Error(result.text || `${result.status} ${result.statusText}`);
        error.status = result.status;
        error.raw = result.text || "";
        throw error;
      };
      sendAttempt(0).then(resolve).catch(reject);
    });
    return {
      promise,
      abort: () => {
        aborted = true;
        try {
          activeXhr?.abort();
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
    const safeUrl = encodeUrlForRequest(url);
    await this.request("MOVE", source, null, {
      Destination: safeUrl
    });
  }

  async copy(source, destination) {
    const url = this.buildUrl(destination);
    const safeUrl = encodeUrlForRequest(url);
    await this.request("COPY", source, null, {
      Destination: safeUrl
    });
  }

  async _fetchWithAuth(url, init = {}) {
    await this._seedDigestChallengeFromSession();
    const method = init.method || "GET";
    const body = init.body;
    const headers = { ...(init.headers || {}) };
    Object.keys(headers).forEach((key) => {
      if (!headers[key]) {
        delete headers[key];
      }
    });
    const preemptive = await this.auth.getPreemptiveAuthorization(method, url, body);
    if (preemptive && !headers.Authorization) {
      headers.Authorization = preemptive;
    }

    const response = await fetch(url, { ...init, headers });
    if (response.status !== 401 || !this.auth.canUseDigest()) {
      return response;
    }
    const parsed = this.auth.observeUnauthorized(response);
    if (!parsed) {
      return response;
    }
    await saveDigestSeed(this.endpoint, this.username, parsed);
    if (!this.auth.isBodyRetryable(body)) {
      return response;
    }
    const digestAuth = await this.auth.getDigestAuthorization(method, url, body);
    if (!digestAuth) {
      return response;
    }
    const retryHeaders = { ...(init.headers || {}), Authorization: digestAuth };
    Object.keys(retryHeaders).forEach((key) => {
      if (!retryHeaders[key]) {
        delete retryHeaders[key];
      }
    });
    return await fetch(url, { ...init, headers: retryHeaders });
  }

  async _seedDigestChallengeFromSession() {
    if (!this.auth?.canUseDigest?.() || this.auth.hasDigestChallenge()) {
      return;
    }
    const seed = await loadDigestSeed(this.endpoint, this.username);
    if (!seed) {
      return;
    }
    try {
      this.auth.seedDigestChallenge(seed);
    } catch {}
  }

  async _ensureDigestChallengeForNonRetryableBody() {
    if (!this.auth?.canUseDigest?.() || this.auth.hasDigestChallenge()) {
      return;
    }
    if (!this.endpoint) {
      return;
    }
    const probeUrl = encodeUrlForRequest(this.buildUrl("/"));
    try {
      await this._fetchWithAuth(probeUrl, { method: "HEAD" });
      if (this.auth.hasDigestChallenge()) {
        return;
      }
      await this._fetchWithAuth(probeUrl, { method: "PROPFIND", headers: { Depth: "0" } });
    } catch {}
  }
}

export function parsePropfindResponse(xml, baseHref) {
  const input = String(xml || "");
  if (input.length > MAX_PROPFIND_XML_CHARS) {
    const error = new Error("XML response too large");
    error.code = "xml_too_large";
    error.status = 0;
    error.raw = "";
    throw error;
  }
  const responseRegex = /<(?:[A-Za-z_][\w.-]*:)?response\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?response>/gi;
  const responses = [];
  let match = responseRegex.exec(input);
  while (match) {
    responses.push(match[1]);
    match = responseRegex.exec(input);
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
  const input = String(xml || "");
  if (input.length > MAX_XML_FRAGMENT_CHARS) {
    logDebug("webdav.xml_fragment_too_large", { tag, length: input.length });
    return "";
  }
  if (typeof DOMParser === "function") {
    try {
      const doc = new DOMParser().parseFromString(`<root>${input}</root>`, "application/xml");
      if (!doc.getElementsByTagName("parsererror").length) {
        const all = doc.getElementsByTagName("*");
        let found = null;
        for (let i = 0; i < all.length; i += 1) {
          const el = all[i];
          if (String(el.localName || "").toLowerCase() === String(tag || "").toLowerCase()) {
            found = el;
            break;
          }
        }
        if (found) {
          const serializer = new XMLSerializer();
          let raw = "";
          for (let i = 0; i < found.childNodes.length; i += 1) {
            raw += serializer.serializeToString(found.childNodes[i]);
          }
          return String(raw || "").trim();
        }
      }
    } catch {}
  }
  const ns = "(?:[A-Za-z_][\\w.-]*:)?";
  const regex = new RegExp(`<\\s*${ns}${tag}\\b[^>]*>([\\s\\S]*?)<\\/\\s*${ns}${tag}\\s*>`, "i");
  const match = input.match(regex);
  return match ? match[1].trim() : "";
}

function extractTagText(xml, tag) {
  const input = String(xml || "");
  if (input.length > MAX_XML_FRAGMENT_CHARS) {
    logDebug("webdav.xml_fragment_too_large", { tag, length: input.length });
    return "";
  }
  if (typeof DOMParser === "function") {
    try {
      const doc = new DOMParser().parseFromString(`<root>${input}</root>`, "application/xml");
      if (!doc.getElementsByTagName("parsererror").length) {
        const all = doc.getElementsByTagName("*");
        for (let i = 0; i < all.length; i += 1) {
          const el = all[i];
          if (String(el.localName || "").toLowerCase() === String(tag || "").toLowerCase()) {
            return decodeXmlEntities(String(el.textContent || "").trim());
          }
        }
      }
    } catch {}
  }
  return decodeXmlEntities(extractTagRaw(input, tag));
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
