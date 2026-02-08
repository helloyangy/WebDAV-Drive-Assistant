import { hashHex } from "./hash.js";

function randomHex(bytesLength) {
  const bytes = new Uint8Array(bytesLength);
  crypto.getRandomValues(bytes);
  const parts = [];
  for (const b of bytes) {
    parts.push(b.toString(16).padStart(2, "0"));
  }
  return parts.join("");
}

function splitCommaOutsideQuotes(value) {
  const out = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
      continue;
    }
    if (ch === "," && !inQuotes) {
      const trimmed = current.trim();
      if (trimmed) {
        out.push(trimmed);
      }
      current = "";
      continue;
    }
    current += ch;
  }
  const trimmed = current.trim();
  if (trimmed) {
    out.push(trimmed);
  }
  return out;
}

function unquote(value) {
  const raw = String(value ?? "").trim();
  if (raw.startsWith('"') && raw.endsWith('"')) {
    return raw.slice(1, -1).replace(/\\"/g, '"');
  }
  return raw;
}

export function parseDigestChallenge(wwwAuthenticate) {
  const raw = String(wwwAuthenticate || "");
  const match = raw.match(/Digest\s+(.+)/i);
  if (!match) {
    return null;
  }
  const rest = match[1];
  const parts = splitCommaOutsideQuotes(rest);
  const params = {};
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq < 0) {
      continue;
    }
    const key = part.slice(0, eq).trim().toLowerCase();
    const val = part.slice(eq + 1).trim();
    params[key] = unquote(val);
  }
  if (!params.nonce || !params.realm) {
    return null;
  }
  const qop = params.qop ? String(params.qop).split(",").map((s) => s.trim()).filter(Boolean) : [];
  const algorithm = params.algorithm ? String(params.algorithm).toUpperCase() : "MD5";
  const charset = params.charset ? String(params.charset).toUpperCase() : "";
  const userhash = String(params.userhash || "").toLowerCase() === "true";
  return {
    realm: params.realm,
    nonce: params.nonce,
    opaque: params.opaque || "",
    qop,
    algorithm,
    charset,
    userhash,
    stale: String(params.stale || "").toLowerCase() === "true"
  };
}

function pickQop(qopList) {
  if (!Array.isArray(qopList) || qopList.length === 0) {
    return "";
  }
  const lower = qopList.map((q) => String(q).toLowerCase());
  if (lower.includes("auth")) {
    return "auth";
  }
  if (lower.includes("auth-int")) {
    return "auth-int";
  }
  return "";
}

function normalizeHashAlgorithm(algorithm) {
  const upper = String(algorithm || "").toUpperCase();
  if (upper.startsWith("SHA-256")) {
    return { hash: "SHA-256", sess: upper.endsWith("-SESS") };
  }
  return { hash: "MD5", sess: upper.endsWith("-SESS") };
}

function quote(value) {
  const raw = String(value ?? "");
  return `"${raw.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function isSameOrigin(a, b) {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return ua.origin === ub.origin;
  } catch {
    return false;
  }
}

export class DigestAuth {
  constructor(options = {}) {
    this.mode = String(options.mode || "auto");
    this.username = String(options.username || "");
    this.password = String(options.password || "");
    this.challenge = null;
    this.nonceCounts = new Map();
    this.endpoint = String(options.endpoint || "");
  }

  updateCredentials({ endpoint, username, password, mode }) {
    this.endpoint = String(endpoint || "");
    this.username = String(username || "");
    this.password = String(password || "");
    this.mode = String(mode || this.mode || "auto");
    this.challenge = null;
    this.nonceCounts = new Map();
  }

  canUseDigest() {
    return !!(this.username && this.password);
  }

  prefersDigest() {
    return String(this.mode || "").toLowerCase() === "digest";
  }

  observeUnauthorizedResponse(response) {
    const www = response?.headers?.get?.("www-authenticate") || "";
    const parsed = parseDigestChallenge(www);
    if (!parsed) {
      return null;
    }
    this.challenge = parsed;
    if (!this.nonceCounts.has(parsed.nonce)) {
      this.nonceCounts.set(parsed.nonce, 0);
    }
    return parsed;
  }

  async buildAuthorization(method, requestUrl, body, overrides = {}) {
    if (!this.canUseDigest() || !this.challenge) {
      return "";
    }
    if (this.endpoint && !isSameOrigin(this.endpoint, requestUrl)) {
      return "";
    }

    const methodUpper = String(method || "").toUpperCase();
    const url = new URL(String(requestUrl || ""));
    const uri = `${url.pathname}${url.search || ""}`;

    const challenge = this.challenge;
    const qop = pickQop(challenge.qop);
    const { hash, sess } = normalizeHashAlgorithm(challenge.algorithm);

    const nonce = challenge.nonce;
    const realm = challenge.realm;
    const opaque = challenge.opaque || "";

    const overrideNc = overrides?.nc;
    const overrideCnonce = overrides?.cnonce;
    let nc = "";
    if (overrideNc !== undefined && overrideNc !== null && overrideNc !== "") {
      if (typeof overrideNc === "number") {
        nc = Math.max(0, Math.floor(overrideNc)).toString(16).padStart(8, "0");
      } else {
        const rawNc = String(overrideNc).trim();
        nc = rawNc.length === 8 ? rawNc : rawNc.padStart(8, "0");
      }
    } else {
      const ncValue = (this.nonceCounts.get(nonce) || 0) + 1;
      this.nonceCounts.set(nonce, ncValue);
      nc = ncValue.toString(16).padStart(8, "0");
    }
    const cnonce = overrideCnonce ? String(overrideCnonce) : randomHex(16);

    const username = this.username;
    const password = this.password;

    const a1 = `${username}:${realm}:${password}`;
    let ha1 = await hashHex(hash, a1);
    if (sess) {
      ha1 = await hashHex(hash, `${ha1}:${nonce}:${cnonce}`);
    }

    let entityHash = "";
    if (qop === "auth-int") {
      if (body === undefined || body === null) {
        entityHash = await hashHex(hash, "");
      } else if (typeof body === "string") {
        entityHash = await hashHex(hash, body);
      } else if (body instanceof Uint8Array) {
        entityHash = await hashHex(hash, body);
      } else if (body instanceof Blob) {
        entityHash = await hashHex(hash, new Uint8Array(await body.arrayBuffer()));
      } else {
        return "";
      }
    }

    const a2 = qop === "auth-int" ? `${methodUpper}:${uri}:${entityHash}` : `${methodUpper}:${uri}`;
    const ha2 = await hashHex(hash, a2);

    const responseValue = qop
      ? await hashHex(hash, `${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
      : await hashHex(hash, `${ha1}:${nonce}:${ha2}`);

    let headerUsername = username;
    if (challenge.userhash) {
      headerUsername = await hashHex(hash, `${username}:${realm}`);
    }

    const parts = [];
    parts.push(`username=${quote(headerUsername)}`);
    parts.push(`realm=${quote(realm)}`);
    parts.push(`nonce=${quote(nonce)}`);
    parts.push(`uri=${quote(uri)}`);
    parts.push(`response=${quote(responseValue)}`);
    if (challenge.algorithm) {
      parts.push(`algorithm=${String(challenge.algorithm).toUpperCase()}`);
    }
    if (opaque) {
      parts.push(`opaque=${quote(opaque)}`);
    }
    if (qop) {
      parts.push(`qop=${qop}`);
      parts.push(`nc=${nc}`);
      parts.push(`cnonce=${quote(cnonce)}`);
    }
    return `Digest ${parts.join(", ")}`;
  }
}

