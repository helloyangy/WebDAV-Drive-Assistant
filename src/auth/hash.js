import { md5Hex } from "./md5.js";

function toUtf8Bytes(input) {
  if (input instanceof Uint8Array) {
    return input;
  }
  return new TextEncoder().encode(String(input ?? ""));
}

function toHex(bytes) {
  const hex = [];
  for (let i = 0; i < bytes.length; i += 1) {
    hex.push(bytes[i].toString(16).padStart(2, "0"));
  }
  return hex.join("");
}

async function sha256Hex(input) {
  const bytes = toUtf8Bytes(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return toHex(new Uint8Array(digest));
}

export async function hashHex(algorithm, input) {
  const normalized = String(algorithm || "").toUpperCase();
  if (normalized === "MD5") {
    return md5Hex(input);
  }
  if (normalized === "SHA-256") {
    return await sha256Hex(input);
  }
  throw new Error(`Unsupported digest algorithm: ${algorithm}`);
}

