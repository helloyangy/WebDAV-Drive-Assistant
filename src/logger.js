const LEVELS = {
  off: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4
};

let currentLevel = LEVELS.warn;

function normalizeLevel(level) {
  const raw = String(level || "").toLowerCase().trim();
  if (raw in LEVELS) {
    return raw;
  }
  return "warn";
}

export function setLogLevel(level) {
  currentLevel = LEVELS[normalizeLevel(level)];
}

export function getLogLevel() {
  const found = Object.entries(LEVELS).find(([, v]) => v === currentLevel)?.[0];
  return found || "warn";
}

function safeForLog(value, depth = 0) {
  if (depth > 3) {
    return "[truncated]";
  }
  if (value instanceof Error) {
    const err = value;
    const out = {
      name: err.name,
      message: err.message,
      code: err.code,
      status: err.status
    };
    return out;
  }
  if (typeof value === "string") {
    return value.length > 2000 ? `${value.slice(0, 2000)}…` : value;
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  if (value instanceof Blob) {
    return { type: value.type || "", size: value.size || 0 };
  }
  if (value instanceof ArrayBuffer) {
    return { type: "ArrayBuffer", byteLength: value.byteLength || 0 };
  }
  if (ArrayBuffer.isView(value)) {
    return { type: value.constructor?.name || "TypedArray", byteLength: value.byteLength || 0 };
  }
  const out = Array.isArray(value) ? [] : {};
  const entries = Array.isArray(value) ? value.entries() : Object.entries(value);
  for (const [k, v] of entries) {
    const key = String(k);
    if (/password|authorization|token|secret/i.test(key)) {
      out[key] = "[redacted]";
      continue;
    }
    out[key] = safeForLog(v, depth + 1);
  }
  return out;
}

function should(level) {
  return currentLevel >= LEVELS[level];
}

export function logDebug(event, meta = null) {
  if (!should("debug")) return;
  try {
    meta ? console.debug(event, safeForLog(meta)) : console.debug(event);
  } catch {}
}

export function logInfo(event, meta = null) {
  if (!should("info")) return;
  try {
    meta ? console.info(event, safeForLog(meta)) : console.info(event);
  } catch {}
}

export function logWarn(event, meta = null) {
  if (!should("warn")) return;
  try {
    meta ? console.warn(event, safeForLog(meta)) : console.warn(event);
  } catch {}
}

export function logError(event, meta = null) {
  if (!should("error")) return;
  try {
    meta ? console.error(event, safeForLog(meta)) : console.error(event);
  } catch {}
}
