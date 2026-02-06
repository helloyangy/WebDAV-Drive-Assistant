export function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject({
          message: chrome.runtime.lastError.message,
          status: 0,
          raw: ""
        });
        return;
      }
      if (!response?.ok) {
        reject({
          message: response?.error || "操作失败",
          status: response?.status || 0,
          raw: response?.raw || ""
        });
        return;
      }
      resolve(response);
    });
  });
}
