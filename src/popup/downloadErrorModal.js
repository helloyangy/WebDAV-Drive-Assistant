export function createDownloadErrorModal(options) {
  const { modalController, downloadErrorText, okButton } = options;

  okButton?.addEventListener("click", () => {
    modalController.close();
  });

  function showDownloadError(detail) {
    if (downloadErrorText) {
      downloadErrorText.textContent = detail ? `下载失败｜${detail}` : "下载失败";
    }
    modalController.open();
  }

  return { showDownloadError };
}
