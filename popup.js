const statusEl = document.getElementById("status");
const pageMetaEl = document.getElementById("pageMeta");
const messagesEl = document.getElementById("messages");
const formEl = document.getElementById("chatForm");
const inputEl = document.getElementById("chatInput");
const sendButtonEl = document.getElementById("sendButton");
const refreshButtonEl = document.getElementById("refreshButton");
const newChatButtonEl = document.getElementById("newChatButton");
const MESSAGE_TIMEOUT_MS = 15000;

let isSending = false;

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

function setStatus(text) {
  statusEl.textContent = text;
}

function setPageMeta(pageContext, pageTitle) {
  if (pageContext?.formFields?.length) {
    pageMetaEl.textContent =
      `${pageContext.title || pageTitle || "Current page"} | ${pageContext.formFields.length} form fields detected`;
    return;
  }

  if (pageContext?.items?.length) {
    pageMetaEl.textContent =
      `${pageContext.title || pageTitle || "Current page"} | ${pageContext.items.length} structured results ready`;
    return;
  }

  if (pageContext?.title || pageTitle) {
    pageMetaEl.textContent = `${pageContext?.title || pageTitle} | Context is light on this page`;
    return;
  }

  pageMetaEl.textContent = "Open a supported webpage to build context automatically.";
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
  messagesEl.replaceChildren();

  const entries = Array.isArray(history) ? history : [];
  if (!entries.length) {
    messagesEl.appendChild(
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

  messagesEl.appendChild(fragment);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function appendMessage(role, text) {
  const node = createMessage(role, text);
  messagesEl.appendChild(node);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return node;
}

function setSending(nextSending) {
  isSending = nextSending;
  inputEl.disabled = nextSending;
  sendButtonEl.disabled = nextSending;
  refreshButtonEl.disabled = nextSending;
  newChatButtonEl.disabled = nextSending;
  sendButtonEl.textContent = nextSending ? "Sending..." : "Send";
}

async function sendMessage(message) {
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

  const response = await sendMessage({
    type: forceRefresh ? "assistant:refreshContext" : "assistant:getConversation",
    forceRefresh
  });

  if (!response?.ok) {
    setPageMeta(null, "");
    messagesEl.replaceChildren(createMessage("assistant", response?.error || "Something went wrong."));
    setStatus("Failed");
    return;
  }

  setPageMeta(response.pageContext, response.pageTitle);
  renderHistory(response.chatHistory);
  setStatus("Ready");
}

async function handleSubmit(event) {
  event.preventDefault();

  if (isSending) {
    return;
  }

  const question = inputEl.value.trim();
  if (!question) {
    return;
  }

  appendMessage("user", question);
  inputEl.value = "";
  const placeholder = appendMessage("assistant", "Thinking...");

  setSending(true);
  setStatus("Thinking...");

  try {
    const response = await sendMessage({
      type: "assistant:sendMessage",
      input: question
    });

    if (!response?.ok) {
      placeholder.querySelector(".bubble").innerHTML = renderRichText(response?.error || "Something went wrong.");
      setStatus("Failed");
      return;
    }

    setPageMeta(response.pageContext, response.pageContext?.title || "");
    renderHistory(response.chatHistory);
    setStatus("Ready");
  } catch (error) {
    placeholder.querySelector(".bubble").innerHTML = renderRichText(error?.message || "Something went wrong.");
    setStatus("Failed");
  } finally {
    setSending(false);
  }
}

formEl.addEventListener("submit", handleSubmit);
refreshButtonEl.addEventListener("click", () => {
  if (!isSending) {
    loadConversation(true);
  }
});
newChatButtonEl.addEventListener("click", async () => {
  if (isSending) {
    return;
  }

  setStatus("Starting new chat...");
  const response = await sendMessage({ type: "assistant:newChat" });

  if (!response?.ok) {
    messagesEl.replaceChildren(createMessage("assistant", response?.error || "Something went wrong."));
    setStatus("Failed");
    return;
  }

  setPageMeta(response.pageContext, response.pageContext?.title || "");
  renderHistory([]);
  setStatus("Ready");
});

setSending(false);
loadConversation(false);
