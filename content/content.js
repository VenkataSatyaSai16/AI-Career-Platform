(function () {
  const MAX_ITEMS = 10;
  const DEBOUNCE_MS = 350;
  const YOUTUBE_HOSTS = new Set(["www.youtube.com", "youtube.com", "m.youtube.com"]);
  const ROOT_ID = "ai-web-assistant-root";
  const HOST_ATTR = "data-ai-web-assistant-root";
  const MESSAGE_TIMEOUT_MS = 15000;

  let observer = null;
  let notifyTimer = 0;
  let lastSerializedContext = "";
  let host = null;
  let shadow = null;
  let ui = null;
  let isOpen = false;
  let isSending = false;
  let lastKnownUrl = location.href;
  let panelPosition = { x: 0, y: 0 };
  let panelSize = { width: 390, height: 620 };
  let pendingPanelFrame = 0;
  let pendingPanelState = null;
  let dragState = null;
  let resizeState = null;

  const CSS_TEXT = `
    :host {
      all: initial;
      position: fixed !important;
      inset: 0 !important;
      display: block !important;
      z-index: 2147483647 !important;
      pointer-events: none !important;
      contain: layout style paint;
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    .assistant-shell {
      position: fixed;
      inset: 0;
      pointer-events: none;
      font-family: Inter, "Segoe UI", sans-serif;
      color: #0f172a;
    }

    .launcher {
      position: fixed;
      right: 20px;
      bottom: 20px;
      width: 62px;
      height: 62px;
      border: 0;
      border-radius: 999px;
      display: grid;
      place-items: center;
      cursor: pointer;
      pointer-events: auto;
      color: #ffffff;
      background:
        radial-gradient(circle at 28% 28%, rgba(255, 255, 255, 0.22), transparent 38%),
        linear-gradient(135deg, #0f172a, #2563eb 58%, #38bdf8);
      box-shadow:
        0 18px 40px rgba(15, 23, 42, 0.34),
        0 4px 12px rgba(37, 99, 235, 0.22);
      transition: transform 160ms ease, box-shadow 160ms ease;
    }

    .launcher:hover {
      transform: translateY(-2px) scale(1.03);
      box-shadow:
        0 22px 48px rgba(15, 23, 42, 0.38),
        0 8px 18px rgba(37, 99, 235, 0.24);
    }

    .launcher:focus-visible {
      outline: 3px solid rgba(37, 99, 235, 0.35);
      outline-offset: 3px;
    }

    .launcher-label {
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 0.02em;
    }

    .panel {
      position: fixed;
      top: 0;
      left: 0;
      width: 390px;
      height: 620px;
      max-width: calc(100vw - 24px);
      border-radius: 22px;
      overflow: hidden;
      border: 1px solid rgba(148, 163, 184, 0.24);
      box-shadow: 0 30px 80px rgba(15, 23, 42, 0.28);
      background:
        radial-gradient(circle at top right, rgba(37, 99, 235, 0.14), transparent 24%),
        linear-gradient(180deg, #eef4ff 0%, #f4f7fb 42%, #f8fafc 100%);
      opacity: 0;
      visibility: hidden;
      transform: translate3d(0, 8px, 0) scale(0.98);
      transform-origin: bottom right;
      transition: opacity 160ms ease, transform 160ms ease, visibility 0s linear 160ms;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      will-change: transform, width, height;
    }

    .panel[data-open="true"] {
      opacity: 1;
      visibility: visible;
      transform: translate3d(0, 0, 0) scale(1);
      transition: opacity 160ms ease, transform 160ms ease, visibility 0s linear 0s;
      pointer-events: auto;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 16px;
      background:
        radial-gradient(circle at top right, rgba(56, 189, 248, 0.24), transparent 32%),
        linear-gradient(135deg, #0f172a, #1e293b);
      color: #fff;
      flex-shrink: 0;
      cursor: grab;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
    }

    .header:active {
      cursor: grabbing;
    }

    .title-wrap {
      min-width: 0;
    }

    .title {
      display: block;
      font-size: 15px;
      font-weight: 800;
      line-height: 1.2;
    }

    .status {
      display: block;
      margin-top: 2px;
      font-size: 12px;
      color: rgba(226, 232, 240, 0.84);
    }

    .header-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .refresh,
    .close,
    .send {
      border: 0;
      border-radius: 999px;
      cursor: pointer;
      font: inherit;
    }

    .refresh {
      padding: 9px 12px;
      background: rgba(255, 255, 255, 0.14);
      color: #fff;
      font-size: 12px;
      font-weight: 700;
    }

    .close {
      width: 32px;
      height: 32px;
      background: rgba(255, 255, 255, 0.14);
      color: #fff;
      font-size: 22px;
      line-height: 1;
    }

    .body {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-height: 0;
      padding: 14px;
      flex: 1;
    }

    .page-meta {
      padding: 10px 12px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.82);
      border: 1px solid #dbe3ef;
      color: #334155;
      font-size: 12px;
      line-height: 1.45;
      flex-shrink: 0;
    }

    .messages {
      flex: 1;
      min-height: 0;
      overflow: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 4px 2px;
    }

    .message {
      display: flex;
    }

    .message.user {
      justify-content: flex-end;
    }

    .message.assistant {
      justify-content: flex-start;
    }

    .bubble {
      max-width: 85%;
      padding: 10px 12px;
      border-radius: 14px;
      font-size: 13px;
      line-height: 1.5;
      word-break: break-word;
      overflow-wrap: anywhere;
    }

    .message.user .bubble {
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: #fff;
    }

    .message.assistant .bubble {
      background: #e2e8f0;
      color: #0f172a;
    }

    .bubble a {
      color: inherit;
      text-decoration: underline;
    }

    .composer {
      display: flex;
      gap: 10px;
      flex-shrink: 0;
    }

    .input {
      flex: 1;
      min-width: 0;
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 11px 14px;
      font: inherit;
      outline: none;
      background: #fff;
      color: #0f172a;
    }

    .input:focus {
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
    }

    .send {
      padding: 11px 16px;
      background: linear-gradient(135deg, #111827, #2563eb);
      color: #fff;
      font-size: 13px;
      font-weight: 700;
    }

    .refresh:disabled,
    .send:disabled,
    .input:disabled {
      opacity: 0.76;
      cursor: progress;
    }

    .resize-handle {
      position: absolute;
      left: 0;
      bottom: 0;
      width: 18px;
      height: 18px;
      pointer-events: auto;
      cursor: nesw-resize;
      border-bottom-left-radius: 22px;
      background:
        linear-gradient(135deg, transparent 0 45%, rgba(148, 163, 184, 0.8) 45% 52%, transparent 52% 100%),
        linear-gradient(135deg, transparent 0 60%, rgba(148, 163, 184, 0.6) 60% 67%, transparent 67% 100%);
      opacity: 0.84;
    }

    .resize-handle:hover {
      opacity: 1;
    }

    @media (max-width: 480px) {
      .panel {
        width: calc(100vw - 20px);
        height: calc(100vh - 100px);
        border-radius: 18px;
      }

      .launcher {
        right: 16px;
        bottom: 16px;
      }
    }
  `;

  function normalizeText(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function toAbsoluteUrl(href) {
    if (!href) {
      return "";
    }

    try {
      return new URL(href, location.href).toString();
    } catch {
      return "";
    }
  }

  function getText(root, selectors) {
    for (const selector of selectors) {
      const element = root.querySelector(selector);
      const text = normalizeText(element?.textContent || element?.getAttribute?.("title") || "");
      if (text) {
        return text;
      }
    }

    return "";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderLinks(text) {
    const escaped = escapeHtml(text);
    return escaped.replace(
      /\b(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi,
      (match) => {
        const href = match.startsWith("http") ? match : `https://${match}`;
        return `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer noopener">${escapeHtml(match)}</a>`;
      }
    );
  }

  function renderRichText(text) {
    const linkTokens = [];
    const linked = renderLinks(String(text ?? "")).replace(/<a\b[\s\S]*?<\/a>/gi, (match) => {
      const token = `__LINK_${linkTokens.length}__`;
      linkTokens.push(match);
      return token;
    });

    let formatted = linked.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    formatted = formatted.replace(/\n/g, "<br>");

    return formatted.replace(/__LINK_(\d+)__/g, (_, index) => linkTokens[Number(index)] || "");
  }

  function extractYouTubeResults() {
    const cards = Array.from(
      document.querySelectorAll(
        "ytd-video-renderer, ytd-grid-video-renderer, ytd-rich-item-renderer ytd-rich-grid-media"
      )
    );

    const items = [];

    for (const card of cards) {
      if (items.length >= MAX_ITEMS) {
        break;
      }

      const titleEl = card.querySelector("#video-title");
      const title = normalizeText(titleEl?.getAttribute("title") || titleEl?.textContent || "");
      if (!title) {
        continue;
      }

      const channel = getText(card, [
        "#channel-name a",
        "#channel-name yt-formatted-string",
        "ytd-channel-name a",
        "ytd-channel-name yt-formatted-string"
      ]);

      const meta = Array.from(card.querySelectorAll("#metadata-line span, #metadata span"))
        .map((element) => normalizeText(element.textContent))
        .filter(Boolean);

      const views =
        meta.find((value) => /view/i.test(value)) ||
        meta.find((value) => /\d/.test(value)) ||
        "";

      items.push({
        title,
        channel,
        views,
        url: toAbsoluteUrl(titleEl?.href || titleEl?.getAttribute("href") || "")
      });
    }

    return items;
  }

  function extractGenericResults() {
    const cards = Array.from(
      document.querySelectorAll("article, main section, [role='article'], .result, .card, .search-result")
    );

    const items = [];

    for (const card of cards) {
      if (items.length >= MAX_ITEMS) {
        break;
      }

      const title = getText(card, ["h1", "h2", "h3", "a[title]", "a"]);
      if (!title || title.length < 8) {
        continue;
      }

      const url = toAbsoluteUrl(card.querySelector("a[href]")?.href || "");
      const detail = getText(card, ["p", ".description", ".snippet", ".summary", ".subtitle"]);

      items.push({
        title,
        channel: detail,
        views: "",
        url
      });
    }

    return items;
  }

  function isVisibleField(element) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    if (element.hidden || element.getAttribute("aria-hidden") === "true") {
      return false;
    }

    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }

    return element.getClientRects().length > 0;
  }

  function getFieldLabel(field) {
    const directLabels = Array.from(field.labels || [])
      .map((label) => normalizeText(label.textContent))
      .filter(Boolean);

    if (directLabels.length) {
      return directLabels.join(" ");
    }

    const id = field.getAttribute("id");
    if (id) {
      const linkedLabel = document.querySelector(`label[for="${CSS.escape(id)}"]`);
      const linkedText = normalizeText(linkedLabel?.textContent || "");
      if (linkedText) {
        return linkedText;
      }
    }

    const ariaLabel = normalizeText(field.getAttribute("aria-label") || "");
    if (ariaLabel) {
      return ariaLabel;
    }

    const wrapperLabel = normalizeText(
      field.closest("label, .field, .form-group, .input-group, .control")?.querySelector("label")?.textContent || ""
    );
    if (wrapperLabel) {
      return wrapperLabel;
    }

    return "";
  }

  function getFieldType(field) {
    const tagName = field.tagName.toLowerCase();
    if (tagName === "select") {
      return "select";
    }

    if (tagName === "textarea") {
      return "textarea";
    }

    const inputType = normalizeText(field.getAttribute("type") || "text").toLowerCase();
    return inputType || "text";
  }

  function getFieldOptions(field) {
    if (!(field instanceof HTMLSelectElement)) {
      return [];
    }

    return Array.from(field.options)
      .map((option) => normalizeText(option.textContent || option.label || option.value || ""))
      .filter(Boolean)
      .slice(0, 50);
  }

  function extractFormFields() {
    const fields = Array.from(document.querySelectorAll("input, select, textarea"));
    const formFields = [];

    for (const field of fields) {
      if (!(field instanceof HTMLElement) || !isVisibleField(field)) {
        continue;
      }

      const type = getFieldType(field);
      if (type === "hidden" || type === "submit" || type === "button" || type === "reset" || type === "image") {
        continue;
      }

      formFields.push({
        index: formFields.length,
        label: getFieldLabel(field),
        name: normalizeText(field.getAttribute("name") || ""),
        placeholder: normalizeText(field.getAttribute("placeholder") || ""),
        type,
        options: getFieldOptions(field),
        required: field.hasAttribute("required"),
        currentValue:
          type === "checkbox" || type === "radio"
            ? Boolean(field.checked)
            : normalizeText(field.value || "")
      });
    }

    return formFields;
  }

  function getFillableDomFields() {
    const fields = Array.from(document.querySelectorAll("input, select, textarea"));

    return fields.filter((field) => {
      if (!(field instanceof HTMLElement) || !isVisibleField(field)) {
        return false;
      }

      const type = getFieldType(field);
      return !["hidden", "submit", "button", "reset", "image"].includes(type);
    });
  }

  function dispatchFieldEvents(field) {
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
    field.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function setNativeValue(field, value) {
    const prototype =
      field instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : field instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : HTMLInputElement.prototype;

    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    if (descriptor?.set) {
      descriptor.set.call(field, value);
      return;
    }

    field.value = value;
  }

  function findSelectOptionValue(field, targetText) {
    const normalizedTarget = normalizeText(targetText).toLowerCase();
    if (!normalizedTarget) {
      return "";
    }

    const option = Array.from(field.options).find((entry) => {
      const text = normalizeText(entry.textContent || entry.label || entry.value || "").toLowerCase();
      return text === normalizedTarget;
    });

    return option?.value || "";
  }

  async function pause(ms) {
    await new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function fillSingleField(field, step) {
    if (!(field instanceof HTMLElement)) {
      return { filled: false, skipped: true, reason: "missing_field" };
    }

    if (step?.sensitive) {
      return { filled: false, skipped: true, sensitive: true, reason: "sensitive_field" };
    }

    const action = normalizeText(step?.action || "").toLowerCase();
    const rawValue = step?.value;
    const value = typeof rawValue === "boolean" ? rawValue : String(rawValue ?? "");
    const type = getFieldType(field);

    field.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    await pause(120);
    field.focus();
    await pause(80);

    if ((value === "" || value == null) && type !== "checkbox") {
      return { filled: false, skipped: true, reason: "empty_value" };
    }

    if (field instanceof HTMLSelectElement || action === "select") {
      const optionValue = findSelectOptionValue(field, value);
      if (!optionValue) {
        return { filled: false, skipped: true, reason: "option_not_found" };
      }

      setNativeValue(field, optionValue);
      dispatchFieldEvents(field);
      await pause(120);
      return { filled: true, skipped: false };
    }

    if (type === "checkbox") {
      const shouldCheck = action === "check" ? true : action === "uncheck" ? false : Boolean(value);
      if (field.checked !== shouldCheck) {
        field.click();
        await pause(120);
      } else {
        dispatchFieldEvents(field);
      }
      return { filled: true, skipped: false };
    }

    if (type === "radio") {
      if (value === "" || value == null) {
        return { filled: false, skipped: true, reason: "empty_value" };
      }

      field.click();
      await pause(120);
      return { filled: true, skipped: false };
    }

    setNativeValue(field, "");
    dispatchFieldEvents(field);
    await pause(50);

    for (const char of String(value)) {
      setNativeValue(field, `${field.value}${char}`);
      field.dispatchEvent(new Event("input", { bubbles: true }));
      await pause(18);
    }

    field.dispatchEvent(new Event("change", { bubbles: true }));
    field.blur();
    return { filled: true, skipped: false };
  }

  async function fillFormSteps(steps) {
    const domFields = getFillableDomFields();
    const sortedSteps = Array.isArray(steps)
      ? [...steps].sort((left, right) => Number(left?.index ?? 0) - Number(right?.index ?? 0))
      : [];

    let filledCount = 0;
    let skippedCount = 0;
    let sensitiveCount = 0;

    for (const step of sortedSteps) {
      const fieldIndex = Number(step?.index);
      if (!Number.isInteger(fieldIndex) || fieldIndex < 0) {
        skippedCount += 1;
        continue;
      }

      const field = domFields[fieldIndex];
      const result = await fillSingleField(field, step);
      if (result.filled) {
        filledCount += 1;
      } else {
        skippedCount += 1;
        if (result.sensitive) {
          sensitiveCount += 1;
        }
      }
    }

    return {
      ok: true,
      filledCount,
      skippedCount,
      sensitiveCount,
      totalCount: sortedSteps.length
    };
  }

  function extractPageContext() {
    const formFields = extractFormFields();
    const site = formFields.length
      ? "form"
      : YOUTUBE_HOSTS.has(location.hostname)
        ? "youtube"
        : "generic";
    const items = site === "youtube" ? extractYouTubeResults() : extractGenericResults();

    return {
      site,
      url: location.href,
      title: normalizeText(document.title),
      extractedAt: new Date().toISOString(),
      items,
      formFields
    };
  }

  function sendContextUpdate() {
    lastKnownUrl = location.href;
    const pageContext = extractPageContext();
    const serialized = JSON.stringify(pageContext);

    if (serialized === lastSerializedContext) {
      return;
    }

    lastSerializedContext = serialized;

    try {
      chrome.runtime.sendMessage({
        type: "page:contextUpdated",
        pageContext
      });
    } catch {
      // Ignore extension reload races.
    }
  }

  function scheduleContextUpdate() {
    window.clearTimeout(notifyTimer);
    notifyTimer = window.setTimeout(sendContextUpdate, DEBOUNCE_MS);
  }

  function checkUrlChange() {
    if (location.href !== lastKnownUrl) {
      lastSerializedContext = "";
      if (ui) {
        setPageMeta(null, "");
        renderHistory([]);
        setStatus("Loading conversation...");
      }
      scheduleContextUpdate();
      loadConversation(true);
    }
  }

  function startObserver() {
    if (observer || !document.documentElement) {
      return;
    }

    observer = new MutationObserver(() => {
      checkUrlChange();
      scheduleContextUpdate();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function applyStyles(root) {
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(CSS_TEXT);
      root.adoptedStyleSheets = [sheet];
    } catch {
      const style = document.createElement("style");
      style.textContent = CSS_TEXT;
      root.appendChild(style);
    }
  }

  function setOpen(nextOpen) {
    if (!ui) {
      return;
    }

    isOpen = nextOpen;
    ui.panel.dataset.open = nextOpen ? "true" : "false";
    ui.launcher.setAttribute("aria-expanded", String(nextOpen));
  }

  function getViewport() {
    const width = window.visualViewport?.width || window.innerWidth || document.documentElement.clientWidth || 0;
    const height = window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 0;
    return { width, height };
  }

  function getPanelConstraints() {
    const viewport = getViewport();
    return {
      minWidth: 320,
      minHeight: 360,
      maxWidth: Math.max(320, viewport.width - 20),
      maxHeight: Math.max(360, viewport.height - 20)
    };
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function getDefaultPanelPlacement() {
    const viewport = getViewport();
    const constraints = getPanelConstraints();
    const width = clamp(panelSize.width, constraints.minWidth, constraints.maxWidth);
    const height = clamp(panelSize.height, constraints.minHeight, constraints.maxHeight);
    const x = Math.max(10, viewport.width - width - 20);
    const y = Math.max(10, viewport.height - height - 94);
    return { x, y, width, height };
  }

  function applyPanelLayout(position, size) {
    if (!ui?.panel) {
      return;
    }

    const constraints = getPanelConstraints();
    const width = clamp(size.width, constraints.minWidth, constraints.maxWidth);
    const height = clamp(size.height, constraints.minHeight, constraints.maxHeight);
    const viewport = getViewport();
    const maxX = Math.max(10, viewport.width - width - 10);
    const maxY = Math.max(10, viewport.height - height - 10);
    const x = clamp(position.x, 10, maxX);
    const y = clamp(position.y, 10, maxY);

    panelPosition = { x, y };
    panelSize = { width, height };
    ui.panel.style.left = `${x}px`;
    ui.panel.style.top = `${y}px`;
    ui.panel.style.width = `${width}px`;
    ui.panel.style.height = `${height}px`;
  }

  function schedulePanelLayout(position, size) {
    pendingPanelState = { position, size };
    if (pendingPanelFrame) {
      return;
    }

    pendingPanelFrame = window.requestAnimationFrame(() => {
      pendingPanelFrame = 0;
      if (!pendingPanelState) {
        return;
      }

      applyPanelLayout(pendingPanelState.position, pendingPanelState.size);
      pendingPanelState = null;
    });
  }

  function setStatus(text) {
    if (ui?.status) {
      ui.status.textContent = text;
    }
  }

  function setPageMeta(pageContext, pageTitle) {
    if (!ui?.pageMeta) {
      return;
    }

    if (pageContext?.formFields?.length) {
      ui.pageMeta.textContent =
        `${pageContext.title || pageTitle || "Current page"} | ${pageContext.formFields.length} form fields detected`;
      return;
    }

    if (pageContext?.items?.length) {
      ui.pageMeta.textContent =
        `${pageContext.title || pageTitle || "Current page"} | ${pageContext.items.length} structured results ready`;
      return;
    }

    if (pageContext?.title || pageTitle) {
      ui.pageMeta.textContent = `${pageContext?.title || pageTitle} | Context is light on this page`;
      return;
    }

    ui.pageMeta.textContent = "Open a supported webpage to build context automatically.";
  }

  function createMessage(role, text) {
    const wrapper = document.createElement("div");
    wrapper.className = `message ${role}`;

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.innerHTML = renderRichText(String(text ?? ""));

    wrapper.appendChild(bubble);
    return wrapper;
  }

  function renderHistory(history) {
    if (!ui?.messages) {
      return;
    }

    ui.messages.replaceChildren();

    const entries = Array.isArray(history) ? history : [];
    if (!entries.length) {
      ui.messages.appendChild(
        createMessage(
          "assistant",
          "Paste the user's details and I'll fill the detected form fields on the page."
        )
      );
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const entry of entries) {
      if (!entry || (entry.role !== "user" && entry.role !== "assistant")) {
        continue;
      }

      fragment.appendChild(createMessage(entry.role, entry.content));
    }

    ui.messages.appendChild(fragment);
    ui.messages.scrollTop = ui.messages.scrollHeight;
  }

  function appendMessage(role, text) {
    if (!ui?.messages) {
      return null;
    }

    const node = createMessage(role, text);
    ui.messages.appendChild(node);
    ui.messages.scrollTop = ui.messages.scrollHeight;
    return node;
  }

  function setSending(nextSending) {
    isSending = nextSending;
    if (!ui) {
      return;
    }

    ui.input.disabled = nextSending;
    ui.send.disabled = nextSending;
    ui.refresh.disabled = nextSending;
    ui.send.textContent = nextSending ? "Sending..." : "Send";
  }

  async function sendRuntimeMessage(message) {
    return new Promise((resolve) => {
      const timeoutId = window.setTimeout(() => {
        resolve({ ok: false, error: "The request timed out. Please try again." });
      }, MESSAGE_TIMEOUT_MS);

      try {
        chrome.runtime.sendMessage(message, (response) => {
          window.clearTimeout(timeoutId);

          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
            return;
          }

          resolve(response || { ok: false, error: "Empty response" });
        });
      } catch (error) {
        window.clearTimeout(timeoutId);
        resolve({ ok: false, error: error?.message || "Failed to contact the extension." });
      }
    });
  }

  async function loadConversation(forceRefresh = false) {
    setStatus(forceRefresh ? "Refreshing context..." : "Loading conversation...");

    const response = await sendRuntimeMessage({
      type: forceRefresh ? "assistant:refreshContext" : "assistant:getConversation",
      forceRefresh
    });

    if (!response?.ok) {
      setPageMeta(null, "");
      if (ui?.messages) {
        ui.messages.replaceChildren(createMessage("assistant", response?.error || "Something went wrong."));
      }
      setStatus("Failed");
      return;
    }

    setPageMeta(response.pageContext, response.pageTitle);
    renderHistory(response.chatHistory);
    setStatus("Ready");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSending || !ui) {
      return;
    }

    const question = ui.input.value.trim();
    if (!question) {
      return;
    }

    appendMessage("user", question);
    ui.input.value = "";
    const placeholder = appendMessage("assistant", "Thinking...");

    setSending(true);
    setStatus("Thinking...");

    try {
      const response = await sendRuntimeMessage({
        type: "assistant:sendMessage",
        input: question
      });

      if (!response?.ok) {
        if (placeholder) {
          placeholder.querySelector(".bubble").innerHTML = renderRichText(
            response?.error || "Something went wrong."
          );
        }
        setStatus("Failed");
        return;
      }

      setPageMeta(response.pageContext, response.pageContext?.title || "");
      renderHistory(response.chatHistory);
      setStatus("Ready");
    } catch (error) {
      if (placeholder) {
        placeholder.querySelector(".bubble").innerHTML = renderRichText(
          error?.message || "Something went wrong."
        );
      }
      setStatus("Failed");
    } finally {
      setSending(false);
    }
  }

  function beginDrag(event) {
    if (!ui || !isOpen || resizeState || event.button !== 0) {
      return;
    }

    if (event.target instanceof Element && event.target.closest("button, input, textarea, select, a")) {
      return;
    }

    dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseX: panelPosition.x,
      baseY: panelPosition.y
    };

    ui.header.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function moveDrag(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    const nextX = dragState.baseX + (event.clientX - dragState.startX);
    const nextY = dragState.baseY + (event.clientY - dragState.startY);
    schedulePanelLayout({ x: nextX, y: nextY }, panelSize);
    event.preventDefault();
  }

  function endDrag(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    if (ui?.header?.hasPointerCapture(event.pointerId)) {
      ui.header.releasePointerCapture(event.pointerId);
    }

    dragState = null;
  }

  function beginResize(event) {
    if (!ui || !isOpen || event.button !== 0) {
      return;
    }

    resizeState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseX: panelPosition.x,
      baseY: panelPosition.y,
      baseWidth: panelSize.width,
      baseHeight: panelSize.height,
      baseRight: panelPosition.x + panelSize.width
    };

    ui.resizeHandle.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }

  function moveResize(event) {
    if (!resizeState || event.pointerId !== resizeState.pointerId) {
      return;
    }

    const constraints = getPanelConstraints();
    const nextWidth = clamp(
      resizeState.baseWidth - (event.clientX - resizeState.startX),
      constraints.minWidth,
      constraints.maxWidth
    );
    const nextHeight = clamp(
      resizeState.baseHeight + (event.clientY - resizeState.startY),
      constraints.minHeight,
      constraints.maxHeight
    );
    const nextX = resizeState.baseRight - nextWidth;

    schedulePanelLayout({ x: nextX, y: resizeState.baseY }, { width: nextWidth, height: nextHeight });
    event.preventDefault();
    event.stopPropagation();
  }

  function endResize(event) {
    if (!resizeState || event.pointerId !== resizeState.pointerId) {
      return;
    }

    if (ui?.resizeHandle?.hasPointerCapture(event.pointerId)) {
      ui.resizeHandle.releasePointerCapture(event.pointerId);
    }

    resizeState = null;
  }

  function mountUi() {
    if (!document.documentElement || document.documentElement.querySelector(`[${HOST_ATTR}="true"]`)) {
      return;
    }

    host = document.createElement("div");
    host.id = ROOT_ID;
    host.setAttribute(HOST_ATTR, "true");
    shadow = host.attachShadow({ mode: "open" });
    applyStyles(shadow);

    shadow.innerHTML = `
      <div class="assistant-shell">
        <button class="launcher" type="button" aria-label="Open AI chatbot" aria-expanded="false">
          <span class="launcher-label">AI</span>
        </button>

        <section class="panel" data-open="false">
          <header class="header">
            <div class="title-wrap">
              <span class="title">AI Web Assistant</span>
              <span class="status">Loading...</span>
            </div>
            <div class="header-actions">
              <button class="refresh" type="button">Refresh</button>
              <button class="close" type="button" aria-label="Close chatbot">&times;</button>
            </div>
          </header>

          <div class="body">
            <div class="page-meta">Building page context...</div>
            <div class="messages"></div>
            <form class="composer">
              <input class="input" type="text" placeholder="Paste user details for this form..." autocomplete="off" />
              <button class="send" type="submit">Send</button>
            </form>
          </div>
          <div class="resize-handle" aria-hidden="true"></div>
        </section>
      </div>
    `;

    const launcher = shadow.querySelector(".launcher");
    const panel = shadow.querySelector(".panel");
    const header = shadow.querySelector(".header");
    const status = shadow.querySelector(".status");
    const refresh = shadow.querySelector(".refresh");
    const close = shadow.querySelector(".close");
    const pageMeta = shadow.querySelector(".page-meta");
    const messages = shadow.querySelector(".messages");
    const form = shadow.querySelector(".composer");
    const input = shadow.querySelector(".input");
    const send = shadow.querySelector(".send");
    const resizeHandle = shadow.querySelector(".resize-handle");

    if (!launcher || !panel || !header || !status || !refresh || !close || !pageMeta || !messages || !form || !input || !send || !resizeHandle) {
      return;
    }

    ui = { launcher, panel, header, status, refresh, close, pageMeta, messages, form, input, send, resizeHandle };

    launcher.addEventListener("click", () => {
      setOpen(!isOpen);
      if (!isOpen) {
        return;
      }

      window.requestAnimationFrame(() => {
        ui.input.focus();
      });
    });

    close.addEventListener("click", () => {
      setOpen(false);
    });

    refresh.addEventListener("click", () => {
      if (!isSending) {
        loadConversation(true);
      }
    });

    header.addEventListener("pointerdown", beginDrag);
    header.addEventListener("pointermove", moveDrag);
    header.addEventListener("pointerup", endDrag);
    header.addEventListener("pointercancel", endDrag);

    resizeHandle.addEventListener("pointerdown", beginResize);
    resizeHandle.addEventListener("pointermove", moveResize);
    resizeHandle.addEventListener("pointerup", endResize);
    resizeHandle.addEventListener("pointercancel", endResize);

    form.addEventListener("submit", handleSubmit);

    document.documentElement.appendChild(host);
    const placement = getDefaultPanelPlacement();
    applyPanelLayout(
      { x: placement.x, y: placement.y },
      { width: placement.width, height: placement.height }
    );
    setSending(false);
    loadConversation(false);
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "GET_STRUCTURED_PAGE_DATA") {
      sendResponse({
        ok: true,
        pageContext: extractPageContext()
      });
      return true;
    }

    if (message?.type === "FILL_FORM_STEPS") {
      fillFormSteps(message.steps)
        .then((result) => {
          scheduleContextUpdate();
          sendResponse(result);
        })
        .catch((error) => {
          sendResponse({
            ok: false,
            error: error?.message || "Failed to fill the form."
          });
        });
      return true;
    }

    return undefined;
  });

  function boot() {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      const result = originalPushState.apply(this, args);
      checkUrlChange();
      return result;
    };

    history.replaceState = function (...args) {
      const result = originalReplaceState.apply(this, args);
      checkUrlChange();
      return result;
    };

    window.addEventListener("popstate", checkUrlChange, { passive: true });
    window.addEventListener("hashchange", checkUrlChange, { passive: true });

    mountUi();
    sendContextUpdate();
    startObserver();
    window.addEventListener(
      "resize",
      () => {
        if (!ui) {
          return;
        }

        applyPanelLayout(panelPosition, panelSize);
      },
      { passive: true }
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
