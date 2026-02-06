export function createStatusController(options) {
  const { connStatus, topHint, getIsConnected } = options;

  function setStatus(text, detail = "", state = "") {
    const message = detail ? `${text}｜${detail}` : text;
    const normalized = String(text || "");
    const normalizedState = String(state || "");
    const isConnectionMessage = ["connecting", "error", "connected", "disconnected"].includes(normalizedState);

    if (connStatus && isConnectionMessage) {
      connStatus.title = message;
      connStatus.classList.remove("connected", "connecting", "disconnected", "error");

      const fallback = getIsConnected() ? "connected" : "disconnected";
      connStatus.classList.add(normalizedState || fallback);
    }

    if (topHint) {
      const show = isConnectionMessage ? normalizedState === "connecting" || normalizedState === "error" : Boolean(normalized);
      topHint.textContent = show ? message : "";
    }
  }

  return { setStatus };
}
