export function encodeBasicAuth(username, password) {
  const raw = `${username}:${password}`;
  const bytes = new TextEncoder().encode(raw);
  const parts = [];
  for (const value of bytes) {
    parts.push(String.fromCharCode(value));
  }
  const token = btoa(parts.join(""));
  return `Basic ${token}`;
}

export function encodeUrlForRequest(url) {
  const raw = String(url || "");
  const parts = raw.split(/(%[0-9A-Fa-f]{2})/g);
  const encoded = parts
    .filter((part) => part !== "")
    .map((part) => {
      if (/^%[0-9A-Fa-f]{2}$/.test(part)) {
        return part;
      }
      return encodeURI(part).replace(/#/g, "%23").replace(/\?/g, "%3F");
    })
    .join("");
  return encoded;
}

export function normalizePath(path) {
  if (!path) {
    return "/";
  }
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  return path.replace(/\/{2,}/g, "/");
}

export function joinPaths(...parts) {
  const joined = parts
    .filter(Boolean)
    .join("/")
    .replace(/\/{2,}/g, "/");
  return normalizePath(joined);
}

export function formatSize(bytes) {
  if (bytes === null || bytes === undefined) {
    return "";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  const mb = kb / 1024;
  if (mb < 1024) {
    return `${mb.toFixed(1)} MB`;
  }
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}

export function formatDate(dateString) {
  if (!dateString) {
    return "";
  }
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString();
}

export async function ensureWebDavDir(client, path) {
  const normalized = normalizePath(String(path || "/"));
  const parts = normalized.split("/").filter(Boolean);
  let current = "/";
  for (const part of parts) {
    current = `${current}${part}/`;
    try {
      await client.mkcol(current);
    } catch (error) {
      const status = error?.status || 0;
      if (status === 405 || status === 409) {
        continue;
      }
      throw error;
    }
  }
}
