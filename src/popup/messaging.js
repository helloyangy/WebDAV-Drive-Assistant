import { logWarn } from "../logger.js";

export function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        logWarn("popup.sendMessage_runtime_error", { type: message?.type, message: chrome.runtime.lastError.message });
        reject({
          message: chrome.runtime.lastError.message || "Runtime error",
          status: 0,
          raw: ""
        });
        return;
      }
      if (!response?.ok) {
        logWarn("popup.sendMessage_response_error", { type: message?.type, status: response?.status || 0, message: response?.error });
        reject({
          message: response?.error || "操作失败",
          status: response?.status || 0,
          raw: response?.raw || "",
          toString() { return this.message; }
        });
        return;
      }
      resolve(response);
    });
  });
}
