export function createPathNavigation(options) {
  const { pathInput, pathChips, normalizePath, listPath } = options;

  function createSeparator() {
    const separator = document.createElement("img");
    separator.className = "path-separator";
    separator.src = "images/slash.svg";
    separator.alt = "";
    separator.setAttribute("aria-hidden", "true");
    return separator;
  }

  function updatePathChips() {
    if (!pathChips) {
      return;
    }
    const current = normalizePath(pathInput.value || "/");
    const trimmed = current.endsWith("/") && current !== "/" ? current.slice(0, -1) : current;
    const parts = trimmed.split("/").filter(Boolean);
    const fragments = [];

    const root = document.createElement("button");
    root.type = "button";
    root.className = "path-root";
    root.title = "根目录";
    root.setAttribute("aria-label", "根目录");
    root.textContent = "";
    const rootIcon = document.createElement("img");
    rootIcon.className = "icon-img";
    rootIcon.src = "images/slash.svg";
    rootIcon.alt = "";
    rootIcon.setAttribute("aria-hidden", "true");
    root.append(rootIcon);
    root.disabled = true;
    fragments.push(root);

    let acc = "";
    for (let i = 0; i < parts.length; i += 1) {
      const segment = parts[i];
      acc += `/${segment}`;
      if (i > 0) {
        fragments.push(createSeparator());
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = segment;
      btn.disabled = i === parts.length - 1;
      const nextPath = acc;
      btn.addEventListener("click", async () => {
        pathInput.value = nextPath;
        await listPath();
      });
      fragments.push(btn);
    }

    pathChips.replaceChildren(...fragments);
  }

  async function enterDirectory(item) {
    if (!item?.isDir) {
      return;
    }
    pathInput.value = normalizePath(`${pathInput.value}/${item.name}`);
    await listPath();
  }

  return { updatePathChips, enterDirectory };
}
