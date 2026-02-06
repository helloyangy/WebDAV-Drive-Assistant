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
