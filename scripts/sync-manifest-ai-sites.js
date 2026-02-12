import fs from "node:fs";
import { AI_BACKUP_MATCHES } from "./ai-sites.js";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function writeJson(path, data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function uniqSorted(list) {
  return Array.from(new Set((Array.isArray(list) ? list : []).map((v) => String(v || "").trim()).filter(Boolean))).sort();
}

function stableStringify(value) {
  return JSON.stringify(value, Object.keys(value).sort());
}

function main() {
  const checkOnly = process.argv.includes("--check");
  const manifestPath = "manifest.json";
  const manifest = readJson(manifestPath);
  const matches = uniqSorted(AI_BACKUP_MATCHES);

  const contentScripts = Array.isArray(manifest.content_scripts) ? manifest.content_scripts : [];
  const contentIndex = contentScripts.findIndex((item) => Array.isArray(item?.js) && item.js.includes("content/aiBackup.js"));
  if (contentIndex < 0) {
    throw new Error("manifest.json: cannot find content_scripts entry for content/aiBackup.js");
  }

  const beforeContentMatches = uniqSorted(contentScripts[contentIndex].matches);
  contentScripts[contentIndex].matches = matches;

  const mainHookIndex = contentScripts.findIndex((item) => Array.isArray(item?.js) && item.js.includes("content/aiBackupMainHook.js"));
  if (mainHookIndex >= 0) {
    contentScripts[mainHookIndex].matches = matches;
  }

  manifest.content_scripts = contentScripts;

  const wars = Array.isArray(manifest.web_accessible_resources) ? manifest.web_accessible_resources : [];
  const warIndex = wars.findIndex((item) => Array.isArray(item?.resources) && item.resources.includes("content/aiBackupMainHook.js"));
  if (warIndex < 0) {
    wars.push({ resources: ["content/aiBackupMainHook.js"], matches });
  } else {
    wars[warIndex].resources = uniqSorted(wars[warIndex].resources);
    wars[warIndex].matches = matches;
  }
  manifest.web_accessible_resources = wars;

  const afterContentMatches = uniqSorted(manifest.content_scripts[contentIndex].matches);
  let same = stableStringify(beforeContentMatches) === stableStringify(afterContentMatches);

  if (mainHookIndex >= 0) {
    const mainHookMatches = uniqSorted(manifest.content_scripts[mainHookIndex].matches);
    if (stableStringify(mainHookMatches) !== stableStringify(afterContentMatches)) {
      same = false;
    }
  }

  if (checkOnly) {
    if (!same) {
      process.exitCode = 1;
      console.error("manifest.json: AI backup matches are out of sync");
    } else {
      console.log("manifest.json: AI backup matches in sync");
    }
    return;
  }

  writeJson(manifestPath, manifest);
  console.log("manifest.json updated");
}

main();

