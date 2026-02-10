import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAllMessages } from "../src/i18n.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readText(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function readJson(relPath) {
  return JSON.parse(readText(relPath));
}

function listFilesRecursive(dirPath, filter) {
  const out = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRecursive(abs, filter));
      continue;
    }
    if (filter(abs)) {
      out.push(abs);
    }
  }
  return out;
}

function toRel(absPath) {
  return path.relative(ROOT, absPath).replace(/\\/g, "/");
}

function extractI18nKeysFromHtml(text) {
  const keys = new Set();
  for (const m of text.matchAll(/data-i18n=(["'])([^"']+)\1/g)) {
    const key = String(m[2] || "").trim();
    if (key) keys.add(key);
  }
  for (const m of text.matchAll(/data-i18n-placeholder=(["'])([^"']+)\1/g)) {
    const key = String(m[2] || "").trim();
    if (key) keys.add(key);
  }
  for (const m of text.matchAll(/data-i18n-attr=(["'])([^"']+)\1/g)) {
    const raw = String(m[2] || "");
    const pairs = raw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => part.split(":").map((x) => x.trim()));
    for (const pair of pairs) {
      const key = pair?.[1];
      if (key) keys.add(key);
    }
  }
  return keys;
}

function extractI18nKeysFromJs(text) {
  const keys = new Set();
  for (const m of text.matchAll(/\b(?:i18n\.)?t\(\s*(["'`])([^"'`]+)\1/g)) {
    const key = String(m[2] || "").trim();
    if (key) keys.add(key);
  }
  for (const m of text.matchAll(/\bt\?\.\(\s*(["'`])([^"'`]+)\1/g)) {
    const key = String(m[2] || "").trim();
    if (key) keys.add(key);
  }
  return keys;
}

function printList(title, items) {
  const list = Array.from(new Set(items)).sort();
  if (!list.length) {
    return;
  }
  console.error(title);
  for (const item of list) {
    console.error(`- ${item}`);
  }
}

function main() {
  readJson("manifest.json");
  readJson("_locales/en/messages.json");
  readJson("_locales/zh_CN/messages.json");

  const allMessages = getAllMessages();
  const zh = allMessages["zh-CN"] || {};
  const baseKeys = new Set(Object.keys(zh));

  const languages = Object.keys(allMessages);
  let ok = true;

  for (const lang of languages) {
    const keys = new Set(Object.keys(allMessages[lang] || {}));
    const missing = Array.from(baseKeys).filter((k) => !keys.has(k));
    const extra = Array.from(keys).filter((k) => !baseKeys.has(k));
    if (missing.length || extra.length) {
      ok = false;
      printList(`[i18n] ${lang} 缺失键`, missing);
      printList(`[i18n] ${lang} 多余键`, extra);
    }
  }

  const htmlFiles = [
    "popup.html",
    "options.html",
    "aiBackupAssist.html"
  ]
    .map((p) => path.join(ROOT, p))
    .filter((p) => fs.existsSync(p));

  const jsFiles = [
    path.join(ROOT, "popup.js"),
    path.join(ROOT, "options.js"),
    path.join(ROOT, "background.js"),
    ...listFilesRecursive(path.join(ROOT, "src"), (p) => p.endsWith(".js"))
  ].filter((p) => fs.existsSync(p) && !toRel(p).endsWith("src/i18n.js"));

  const referencedKeys = new Set();
  const referencedFrom = new Map();

  for (const abs of htmlFiles) {
    const rel = toRel(abs);
    const text = fs.readFileSync(abs, "utf8");
    const keys = extractI18nKeysFromHtml(text);
    for (const key of keys) {
      referencedKeys.add(key);
      if (!referencedFrom.has(key)) referencedFrom.set(key, []);
      referencedFrom.get(key).push(rel);
    }
  }

  for (const abs of jsFiles) {
    const rel = toRel(abs);
    const text = fs.readFileSync(abs, "utf8");
    const keys = extractI18nKeysFromJs(text);
    for (const key of keys) {
      referencedKeys.add(key);
      if (!referencedFrom.has(key)) referencedFrom.set(key, []);
      referencedFrom.get(key).push(rel);
    }
  }

  const missingInMessages = Array.from(referencedKeys).filter((k) => !baseKeys.has(k));
  if (missingInMessages.length) {
    ok = false;
    console.error("[i18n] 页面/代码引用了未定义的 key");
    for (const key of missingInMessages.sort()) {
      const files = (referencedFrom.get(key) || []).sort();
      console.error(`- ${key}  (${files.join(", ")})`);
    }
  }

  const unused = Array.from(baseKeys).filter((k) => !referencedKeys.has(k));
  if (unused.length) {
    console.log(`[i18n] 未被页面/代码引用的 key: ${unused.length}`);
  }

  if (!ok) {
    process.exitCode = 1;
    return;
  }
  console.log("i18n ok");
}

main();


