function stripHtml(html) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function createErrorFormatter(t) {
  return function formatErrorDetail(error) {
    const status = error?.status || 0;
    const raw = error?.raw || "";
    const code = error?.code || "";
    const msg = error?.message || t("error.failed");
    const cleaned = stripHtml(String(msg || "")) || String(msg || "");
    const lower = cleaned.toLowerCase();
    if (code === "html_response") {
      return t("error.htmlResponse");
    }
    if (status === 401) {
      const detail = stripHtml(raw) || t("error.auth401Default");
      return t("error.auth401", { detail });
    }
    if (status === 403) {
      return t("error.forbidden403");
    }
    if (status === 404) {
      return t("error.notFound404");
    }
    if (status === 405) {
      return t("error.method405");
    }
    if (status >= 500) {
      return t("error.server5xx", { status });
    }
    if (!status) {
      if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
        return t("error.network");
      }
      if (lower.includes("string contains non iso-8859-1")) {
        return t("error.headerInvalid");
      }
    }
    if (cleaned === "Unknown message" || cleaned.startsWith("Unknown message:")) {
      return t("error.unknownMessage");
    }
    if (cleaned) {
      return cleaned;
    }
    return t("error.failed");
  };
}
