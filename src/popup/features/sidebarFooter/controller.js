export function createSidebarFooterController(options) {
  const { helpBtn, githubBtn, helpModalController, t } = options;

  function init() {
    helpBtn?.addEventListener("click", () => {
      helpModalController.open(t?.("ui.help") || "使用说明");
    });

    githubBtn?.addEventListener("click", () => {
      chrome.tabs.create({ url: "https://github.com/helloyangy/WebDAV-Drive-Assistant" }).catch(() => {});
    });
  }

  return { init };
}

