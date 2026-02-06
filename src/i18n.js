const SUPPORTED_LANGUAGES = ["zh-CN", "en"];

const MESSAGES = {
  "zh-CN": {
    "lang.zh": "中文",
    "lang.en": "English",
    "common.save": "保存",
    "common.cancel": "取消",
    "common.ok": "确定",
    "common.close": "关闭",
    "common.done": "完成",
    "common.error": "错误",
    "common.loading": "加载中...",
    "common.previewing": "预览中...",
    "common.connecting": "连接中...",
    "common.connected": "已连接",
    "common.disconnected": "未连接",
    "common.connectFailed": "连接失败",
    "common.copied": "已复制",
    "common.copyFailed": "复制失败",
    "common.refreshDone": "刷新完成",
    "common.cacheCleared": "缓存已清理",
    "common.uploading": "上传中...",
    "common.uploadingProgress": "上传中... {percent}%",
    "common.uploadCanceled": "已取消上传",
    "common.uploadDone": "上传完成",
    "common.creating": "创建中...",
    "common.deleting": "删除中...",
    "common.renaming": "重命名中...",
    "common.downloading": "下载中...",
    "common.path": "路径",
    "ui.searchPlaceholder": "搜索...",
    "ui.layoutList": "排列：竖排",
    "ui.layoutGrid": "排列：横排",
    "ui.fileList": "文件列表",
    "upload.title": "上传详情",
    "upload.details": "查看上传详情",
    "upload.button": "上传",
    "upload.total": "总大小",
    "upload.uploaded": "已上传",
    "upload.speed": "网速",
    "upload.abort": "终止上传",
    "aiBackup.title": "AI 备份设置",
    "aiBackup.mode": "备份模式",
    "aiBackup.mode.off": "禁止备份",
    "aiBackup.mode.ask": "备份询问",
    "aiBackup.mode.auto": "自动备份",
    "aiBackup.blockedTypes": "禁止备份文件类型（扩展名，逗号分隔）",
    "aiBackup.blockedTypesHelp": "支持输入 .zip/.exe，支持逗号或空格分隔",
    "aiBackup.blockedSites": "禁止备份的网站",
    "aiBackup.saved": "AI 备份设置已保存",
    "aiSite.chatgpt": "ChatGPT",
    "aiSite.gemini": "Gemini",
    "aiSite.grok": "Grok",
    "aiSite.claude": "Claude",
    "aiSite.doubao": "豆包",
    "aiSite.yuanbao": "元宝",
    "aiSite.qianwen": "千问",
    "aiBackup.ask.title": "是否备份该文件到网盘？",
    "aiBackup.ask.yes": "备份",
    "aiBackup.ask.no": "不备份",
    "ui.refresh": "刷新",
    "ui.newFolder": "新建文件夹",
    "ui.new": "新建",
    "ui.upload": "上传",
    "ui.download": "下载",
    "ui.delete": "删除",
    "ui.settings": "设置",
    "ui.aiBackup": "AI 备份",
    "ui.addAccount": "新增账号",
    "ui.help": "使用说明",
    "ui.goUp": "返回上一级",
    "ui.goHome": "返回主页",
    "ui.layout": "排列",
    "ui.preview": "预览",
    "ui.enter": "进入",
    "ui.copyPath": "复制路径",
    "ui.rename": "重命名",
    "ui.edit": "编辑",
    "ui.connect": "连接",
    "ui.openMode": "打开方式",
    "ui.openMode.popup": "弹窗",
    "ui.openMode.tab": "标签页",
    "ui.language": "语言",
    "ui.sortDefault": "默认排序",
    "ui.sortBy": "默认排序字段",
    "ui.sortBy.name": "名称",
    "ui.sortBy.modified": "时间",
    "ui.sortBy.size": "大小",
    "ui.sortOrder": "默认排序顺序",
    "ui.sort.asc": "升序",
    "ui.sort.desc": "降序",
    "ui.hideDotfiles": "隐藏 . 开头文件",
    "ui.concurrency": "并发数",
    "ui.cacheLimit": "缓存上限(MB)",
    "ui.autoSync": "自动同步",
    "ui.syncInterval": "同步间隔(分钟)",
    "ui.clearCache": "清理缓存",
    "ui.saveSettings": "保存设置",
    "ui.accountModal.add": "新增账号",
    "ui.accountModal.edit": "编辑账号",
    "ui.name": "名称",
    "ui.namePlaceholder": "例如：我的账号",
    "ui.endpoint": "服务器地址",
    "ui.endpointPlaceholder": "https://example.com/webdav/",
    "ui.username": "用户名",
    "ui.password": "密码",
    "ui.rootPath": "根路径",
    "ui.advanced": "高级设置",
    "ui.accountList.empty": "暂无账号",
    "ui.downloadError.title": "下载失败",
    "ui.downloadError.ok": "知道了",
    "options.pageTitle": "WebDAV 设置",
    "options.saved": "已保存",
    "dialog.confirm": "确认",
    "dialog.prompt": "请输入",
    "dialog.content": "内容",
    "dialog.deleteAccount.title": "删除账号",
    "dialog.deleteAccount.message": "确定删除账号：{name}？",
    "dialog.clearCache.title": "清理缓存",
    "dialog.clearCache.message": "将清空已缓存的预览/下载内容。",
    "dialog.clearCache.ok": "清理",
    "status.connectHint": "点击左侧账号连接",
    "status.needEndpoint": "请先填写服务器地址",
    "status.needConnectToBrowse": "点击左侧账号连接后再浏览文件",
    "status.fillConnectionInfo": "请填写连接信息",
    "status.accountDeleted": "账号已删除",
    "status.currentAccount": "当前账号：{name}",
    "status.currentAccountLoading": "当前账号：{name}｜加载中...",
    "status.total": "当前账号：{name}｜共 {total} 项",
    "status.shown": "当前账号：{name}｜显示 {shown} / {total} 项",
    "status.settingsSaved": "设置已保存",
    "status.clearingCache": "清理缓存中...",
    "preview.tooLarge": "文件过大，暂不支持文本预览，请下载查看。",
    "preview.unsupported": "暂不支持预览该格式，请下载查看。",
    "status.selectFile": "请选择文件",
    "status.selectItemToDelete": "请选择要删除的项",
    "status.selectItemToRename": "请选择要重命名的项",
    "status.deleteFailed": "删除失败",
    "status.renameFailed": "重命名失败",
    "dialog.deleteItem.message": "确定删除：{name}{suffix}？",
    "dialog.renameItem.title": "重命名",
    "dialog.renameItem.message": "当前名称：{name}{suffix}",
    "dialog.renameItem.label": "新名称",
    "dialog.renameItem.placeholder": "请输入新名称",
    "dialog.mkdir.title": "新建文件夹",
    "dialog.mkdir.label": "文件夹名称",
    "dialog.mkdir.placeholder": "例如：新建文件夹",
    "error.nameInvalid": "名称不能包含 / 或 \\\\",
    "error.folderNameInvalid": "文件夹名称不能包含 / 或 \\\\",
    "error.auth401": "认证失败（401）｜{detail}",
    "error.auth401Default": "服务器拒绝了当前账号，请检查用户名和密码。",
    "error.forbidden403": "权限不足（403）｜当前账号无访问权限，请检查权限设置。",
    "error.notFound404": "路径不存在（404）｜请检查根路径或目录是否正确。",
    "error.method405": "方法不允许（405）｜该服务器可能不支持 WebDAV 或被禁用。",
    "error.server5xx": "服务器错误（{status}）｜服务器内部异常，请稍后重试。",
    "error.network": "网络错误｜无法连接服务器（检查地址/网络/证书/跨域限制）",
    "error.htmlResponse": "服务器返回 HTML（可能未登录/鉴权失败/路径错误）",
    "error.headerInvalid": "请求失败｜请求头包含非法字符（可能是中文/特殊字符路径）",
    "error.unknownMessage": "扩展后台未识别该请求",
    "error.failed": "操作失败",
    "empty.searchNoResult": "没有匹配结果"
  },
  en: {
    "lang.zh": "中文",
    "lang.en": "English",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.ok": "OK",
    "common.close": "Close",
    "common.done": "Done",
    "common.error": "Error",
    "common.loading": "Loading...",
    "common.previewing": "Previewing...",
    "common.connecting": "Connecting...",
    "common.connected": "Connected",
    "common.disconnected": "Disconnected",
    "common.connectFailed": "Connection failed",
    "common.copied": "Copied",
    "common.copyFailed": "Copy failed",
    "common.refreshDone": "Refreshed",
    "common.cacheCleared": "Cache cleared",
    "common.uploading": "Uploading...",
    "common.uploadingProgress": "Uploading... {percent}%",
    "common.uploadCanceled": "Upload canceled",
    "common.uploadDone": "Upload completed",
    "common.creating": "Creating...",
    "common.deleting": "Deleting...",
    "common.renaming": "Renaming...",
    "common.downloading": "Downloading...",
    "common.path": "Path",
    "ui.searchPlaceholder": "Search...",
    "ui.layoutList": "Layout: list",
    "ui.layoutGrid": "Layout: grid",
    "ui.fileList": "File list",
    "upload.title": "Upload details",
    "upload.details": "View upload details",
    "upload.button": "Upload",
    "upload.total": "Total size",
    "upload.uploaded": "Uploaded",
    "upload.speed": "Speed",
    "upload.abort": "Cancel upload",
    "aiBackup.title": "AI backup settings",
    "aiBackup.mode": "Backup mode",
    "aiBackup.mode.off": "Disabled",
    "aiBackup.mode.ask": "Ask",
    "aiBackup.mode.auto": "Auto",
    "aiBackup.blockedTypes": "Blocked types (extensions, comma-separated)",
    "aiBackup.blockedTypesHelp": "Supports .zip/.exe, separated by comma or space",
    "aiBackup.blockedSites": "Blocked sites",
    "aiBackup.saved": "AI backup settings saved",
    "aiSite.chatgpt": "ChatGPT",
    "aiSite.gemini": "Gemini",
    "aiSite.grok": "Grok",
    "aiSite.claude": "Claude",
    "aiSite.doubao": "Doubao",
    "aiSite.yuanbao": "Yuanbao",
    "aiSite.qianwen": "Qianwen",
    "aiBackup.ask.title": "Back up this file to WebDAV?",
    "aiBackup.ask.yes": "Back up",
    "aiBackup.ask.no": "Skip",
    "ui.refresh": "Refresh",
    "ui.newFolder": "New folder",
    "ui.new": "New",
    "ui.upload": "Upload",
    "ui.download": "Download",
    "ui.delete": "Delete",
    "ui.settings": "Settings",
    "ui.aiBackup": "AI Backup",
    "ui.addAccount": "Add account",
    "ui.help": "Help",
    "ui.goUp": "Up",
    "ui.goHome": "Home",
    "ui.layout": "Layout",
    "ui.preview": "Preview",
    "ui.enter": "Enter",
    "ui.copyPath": "Copy path",
    "ui.rename": "Rename",
    "ui.edit": "Edit",
    "ui.connect": "Connect",
    "ui.openMode": "Open mode",
    "ui.openMode.popup": "Popup",
    "ui.openMode.tab": "Tab",
    "ui.language": "Language",
    "ui.sortDefault": "Default sort",
    "ui.sortBy": "Sort field",
    "ui.sortBy.name": "Name",
    "ui.sortBy.modified": "Modified",
    "ui.sortBy.size": "Size",
    "ui.sortOrder": "Sort order",
    "ui.sort.asc": "Asc",
    "ui.sort.desc": "Desc",
    "ui.hideDotfiles": "Hide dotfiles",
    "ui.concurrency": "Concurrency",
    "ui.cacheLimit": "Cache limit (MB)",
    "ui.autoSync": "Auto sync",
    "ui.syncInterval": "Sync interval (min)",
    "ui.clearCache": "Clear cache",
    "ui.saveSettings": "Save settings",
    "ui.accountModal.add": "Add account",
    "ui.accountModal.edit": "Edit account",
    "ui.name": "Name",
    "ui.namePlaceholder": "e.g. My account",
    "ui.endpoint": "Endpoint",
    "ui.endpointPlaceholder": "https://example.com/webdav/",
    "ui.username": "Username",
    "ui.password": "Password",
    "ui.rootPath": "Root path",
    "ui.advanced": "Advanced",
    "ui.accountList.empty": "No accounts",
    "ui.downloadError.title": "Download failed",
    "ui.downloadError.ok": "Got it",
    "options.pageTitle": "WebDAV Settings",
    "options.saved": "Saved",
    "dialog.confirm": "Confirm",
    "dialog.prompt": "Input",
    "dialog.content": "Content",
    "dialog.deleteAccount.title": "Delete account",
    "dialog.deleteAccount.message": "Delete account: {name}?",
    "dialog.clearCache.title": "Clear cache",
    "dialog.clearCache.message": "This will clear cached previews/downloads.",
    "dialog.clearCache.ok": "Clear",
    "status.connectHint": "Select an account on the left to connect",
    "status.needEndpoint": "Please enter the endpoint first",
    "status.needConnectToBrowse": "Connect an account first to browse files",
    "status.fillConnectionInfo": "Please fill in connection info",
    "status.accountDeleted": "Account deleted",
    "status.currentAccount": "Account: {name}",
    "status.currentAccountLoading": "Account: {name} | Loading...",
    "status.total": "Account: {name} | {total} items",
    "status.shown": "Account: {name} | {shown} / {total} items",
    "status.settingsSaved": "Settings saved",
    "status.clearingCache": "Clearing cache...",
    "preview.tooLarge": "File is too large for text preview. Please download to view.",
    "preview.unsupported": "Preview is not supported for this format. Please download to view.",
    "status.selectFile": "Please select a file",
    "status.selectItemToDelete": "Please select an item to delete",
    "status.selectItemToRename": "Please select an item to rename",
    "status.deleteFailed": "Delete failed",
    "status.renameFailed": "Rename failed",
    "dialog.deleteItem.message": "Delete: {name}{suffix}?",
    "dialog.renameItem.title": "Rename",
    "dialog.renameItem.message": "Current name: {name}{suffix}",
    "dialog.renameItem.label": "New name",
    "dialog.renameItem.placeholder": "Enter a new name",
    "dialog.mkdir.title": "New folder",
    "dialog.mkdir.label": "Folder name",
    "dialog.mkdir.placeholder": "e.g. New folder",
    "error.nameInvalid": "Name cannot contain / or \\\\",
    "error.folderNameInvalid": "Folder name cannot contain / or \\\\",
    "error.auth401": "Authentication failed (401) | {detail}",
    "error.auth401Default": "The server rejected this account. Check username/password.",
    "error.forbidden403": "Forbidden (403) | This account has no permission.",
    "error.notFound404": "Not found (404) | Check root path or directory.",
    "error.method405": "Method not allowed (405) | WebDAV may be disabled on the server.",
    "error.server5xx": "Server error ({status}) | Please try again later.",
    "error.network": "Network error | Unable to reach the server (URL/network/cert/CORS)",
    "error.htmlResponse": "Server returned HTML (maybe unauthorized/path incorrect)",
    "error.headerInvalid": "Request failed | Invalid header characters (non-ISO-8859-1)",
    "error.unknownMessage": "Background did not recognize this request",
    "error.failed": "Operation failed",
    "empty.searchNoResult": "No results"
  }
};

export function normalizeLanguage(language) {
  if (language === "en") {
    return "en";
  }
  if (language === "zh" || language === "zh-CN") {
    return "zh-CN";
  }
  return "zh-CN";
}

export function createI18n(language) {
  const lang = normalizeLanguage(language);
  const messages = MESSAGES[lang] || MESSAGES["zh-CN"];
  function t(key, vars = null) {
    const template = messages[key] ?? MESSAGES["zh-CN"][key] ?? String(key || "");
    if (!vars) {
      return template;
    }
    return String(template).replace(/\{(\w+)\}/g, (_, name) => {
      const value = vars[name];
      return value === undefined || value === null ? "" : String(value);
    });
  }
  return { lang, t };
}

export function applyI18n(root, i18n) {
  const target = root || document;
  const { lang, t } = i18n || createI18n("zh-CN");
  if (target?.documentElement) {
    target.documentElement.setAttribute("lang", lang);
  } else {
    document.documentElement.setAttribute("lang", lang);
  }

  const scope = target.querySelectorAll ? target : document;
  scope.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (key) {
      el.textContent = t(key);
    }
  });
  scope.querySelectorAll("[data-i18n-attr]").forEach((el) => {
    const raw = el.getAttribute("data-i18n-attr") || "";
    const pairs = raw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => part.split(":").map((x) => x.trim()));
    for (const [attr, key] of pairs) {
      if (!attr || !key) {
        continue;
      }
      el.setAttribute(attr, t(key));
    }
  });
  scope.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (key) {
      el.setAttribute("placeholder", t(key));
    }
  });

  scope.querySelectorAll("[data-i18n-show-lang]").forEach((el) => {
    const showLang = el.getAttribute("data-i18n-show-lang") || "";
    el.hidden = normalizeLanguage(showLang) !== lang;
  });
}

export function getSupportedLanguages() {
  return [...SUPPORTED_LANGUAGES];
}

