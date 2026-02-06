import fs from "node:fs";

function readJson(path) {
  const text = fs.readFileSync(path, "utf8");
  return JSON.parse(text);
}

readJson("manifest.json");
readJson("_locales/en/messages.json");
readJson("_locales/zh_CN/messages.json");

console.log("i18n manifest JSON ok");

