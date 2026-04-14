const BACKEND_CHAT_URL = "http://localhost:3000/chat";
const BACKEND_MODELS = ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
const REQUEST_TIMEOUT_MS = 25000;
const HISTORY_LIMIT = 10;

const tabSessions = new Map();

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function sanitizeHistory(history) {
  return Array.isArray(history)
    ? history
      .filter((entry) => entry && (entry.role === "user" || entry.role === "assistant"))
      .map((entry) => ({
        role: entry.role,
        content: String(entry.content ?? "").trim()
      }))
      .filter((entry) => entry.content)
      .slice(-HISTORY_LIMIT)
    : [];
}

function clonePageContext(pageContext) {
  return pageContext && typeof pageContext === "object"
    ? JSON.parse(JSON.stringify(pageContext))
    : null;
}

function getSession(tabId, tabUrl = "") {
  if (!tabSessions.has(tabId)) {
    tabSessions.set(tabId, {
      pageContext: null,
      chatHistory: [],
      url: tabUrl || ""
    });
  }

  const session = tabSessions.get(tabId);
  if (tabUrl && !session.url) {
    session.url = tabUrl;
  }

  return session;
}

function hasUrlChanged(session, nextUrl) {
  return Boolean(nextUrl) && Boolean(session?.url) && session.url !== nextUrl;
}

function resetSession(tabId, nextUrl = "") {
  const session = getSession(tabId, nextUrl);
  session.pageContext = null;
  session.chatHistory = [];
  session.url = nextUrl || session.url || "";
  return session;
}

function ensureSessionUrl(tabId, nextUrl = "") {
  const session = getSession(tabId, nextUrl);

  if (hasUrlChanged(session, nextUrl)) {
    return resetSession(tabId, nextUrl);
  }

  if (nextUrl && !session.url) {
    session.url = nextUrl;
  }

  return session;
}

function clearChatHistory(tabId) {
  const session = getSession(tabId);
  session.chatHistory = [];
  return session;
}

function appendHistory(tabId, role, content) {
  const session = getSession(tabId);
  session.chatHistory.push({
    role,
    content: String(content ?? "").trim()
  });
  session.chatHistory = sanitizeHistory(session.chatHistory);
  return session;
}

function extractAssistantContent(data) {
  if (typeof data?.choices?.[0]?.message?.content === "string") {
    return data.choices[0].message.content.trim();
  }

  const content = data?.choices?.[0]?.message?.content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("")
      .trim();
  }

  if (typeof data?.choices?.[0]?.text === "string") {
    return data.choices[0].text.trim();
  }

  if (typeof data?.output_text === "string") {
    return data.output_text.trim();
  }

  return "";
}

function extractJsonBlock(text) {
  const raw = String(text ?? "").trim();
  if (!raw) {
    return "";
  }

  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return raw.slice(firstBrace, lastBrace + 1);
  }

  return raw;
}

function parseFillPlan(answer) {
  const jsonText = extractJsonBlock(answer);
  let parsed;

  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("The AI returned an invalid fill plan.");
  }

  const steps = Array.isArray(parsed?.steps) ? parsed.steps : [];
  return {
    steps: steps.map((step) => ({
      index: Number.isInteger(step?.index) ? step.index : Number(step?.index),
      field: normalizeText(step?.field || ""),
      value: typeof step?.value === "boolean" ? step.value : String(step?.value ?? ""),
      action: normalizeText(step?.action || ""),
      confidence: Number(step?.confidence ?? 0),
      sensitive: Boolean(step?.sensitive)
    }))
  };
}

function summarizeFillResult(result) {
  const filledCount = Number(result?.filledCount || 0);
  const skippedCount = Number(result?.skippedCount || 0);
  const totalCount = Number(result?.totalCount || 0);
  const sensitiveCount = Number(result?.sensitiveCount || 0);

  if (!totalCount) {
    return "No form fields were filled.";
  }

  if (!filledCount) {
    if (sensitiveCount) {
      return `I checked ${totalCount} fields, skipped ${sensitiveCount} sensitive fields, and left the rest blank because the values were missing or unclear.`;
    }

    return `I checked ${totalCount} fields but skipped them because the values were missing or unclear.`;
  }

  if (sensitiveCount) {
    return `Filled ${filledCount} of ${totalCount} fields, skipped ${sensitiveCount} sensitive fields for confirmation, and skipped ${Math.max(skippedCount - sensitiveCount, 0)} others.`;
  }

  return `Filled ${filledCount} of ${totalCount} fields and skipped ${skippedCount}.`;
}

function buildUserDetailsText(chatHistory, userInput) {
  const priorUserEntries = sanitizeHistory(chatHistory)
    .filter((entry) => entry.role === "user")
    .map((entry) => entry.content)
    .filter(Boolean);

  return [...priorUserEntries, normalizeText(userInput)].join("\n");
}

function buildMessages(pageContext, chatHistory, userInput) {
  const formFields = Array.isArray(pageContext?.formFields) ? pageContext.formFields : [];
  const userDetails = buildUserDetailsText(chatHistory, userInput);

  return [
    {
      role: "system",
      content:
        "You are an AI browser assistant that fills web forms intelligently and safely.\n\n" +
        "Your job is to:\n" +
        "- Map user details to form fields\n" +
        "- Identify sensitive fields\n" +
        "- Prepare structured steps for a browser agent\n\n" +
        "TASK:\n" +
        "1. Match each form field with the most relevant value from USER DETAILS.\n" +
        "2. Identify SENSITIVE fields such as:\n" +
        "   - password\n" +
        "   - otp / verification code\n" +
        "   - card number\n" +
        "   - cvv\n" +
        "   - expiry date\n" +
        "   - bank details\n" +
        "3. For sensitive fields:\n" +
        '   - mark "sensitive": true\n' +
        "   - still return value if the user provided it\n" +
        "   - DO NOT prioritize or assume values\n" +
        "4. For non-sensitive fields:\n" +
        "   - fill normally with the best match\n\n" +
        "OUTPUT FORMAT (STRICT JSON ONLY):\n" +
        "{\n" +
        '  "steps": [\n' +
        "    {\n" +
        '      "index": 0,\n' +
        '      "field": "Full Name",\n' +
        '      "value": "VENKATA SATYA SAI",\n' +
        '      "confidence": 0.95,\n' +
        '      "sensitive": false\n' +
        "    }\n" +
        "  ]\n" +
        "}\n\n" +
        "RULES:\n" +
        "- Output ONLY valid JSON.\n" +
        "- No explanations.\n" +
        "- No markdown.\n" +
        "- No extra text.\n" +
        "- Always include ALL fields.\n" +
        '- If value is unknown, use value = "" and low confidence.\n' +
        "- Do NOT hallucinate data.\n\n" +
        "MAPPING GUIDELINES:\n" +
        "- Name -> full name.\n" +
        "- Email -> email address.\n" +
        "- Phone -> mobile number.\n" +
        "- Age -> numeric.\n" +
        "- City -> location.\n" +
        "- Password -> only if explicitly provided.\n" +
        "- OTP -> NEVER guess.\n" +
        "- Dropdown/select -> return visible option text.\n" +
        "- Checkbox -> return true or false.\n\n" +
        "IMPORTANT:\n" +
        "- This output will be used by a browser assistant with a security gateway.\n" +
        "- Non-sensitive fields will be filled automatically.\n" +
        "- Sensitive fields will require user confirmation.\n" +
        "- Preserve the given field order.\n" +
        "- Return one step for every form field index.\n" +
        "- Set field to the best human-readable field name, usually label, otherwise name, otherwise placeholder, otherwise type.\n" +
        "- Ensure values are clean strings except checkbox values which may be true or false.\n" +
        '- If there are no form fields, return {"steps":[]}.'
    },
    {
      role: "user",
      content:
        `USER DETAILS:\n${userDetails}\n\n` +
        `FORM FIELDS (JSON):\n${JSON.stringify(formFields, null, 2)}`
    }
  ];
}

async function callBackendWithModel(model, messages) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(BACKEND_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.1,
        max_completion_tokens: 1200
      }),
      signal: controller.signal
    });

    const text = await response.text();
    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!response.ok) {
      const error = new Error(
        data?.error || text || `Backend request failed with status ${response.status}.`
      );
      error.status = response.status;
      throw error;
    }

    if (!data || typeof data !== "object") {
      throw new Error("Invalid response from backend.");
    }

    if (data.error) {
      throw new Error(String(data.error));
    }

    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("The backend request timed out.");
    }

    if (error instanceof TypeError) {
      throw new Error("Unable to reach the backend. Start backend/server.js on port 3000.");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callBackend(messages) {
  let lastError = null;

  for (const model of BACKEND_MODELS) {
    try {
      return await callBackendWithModel(model, messages);
    } catch (error) {
      lastError = error;
      if (![400, 404, 422].includes(error?.status)) {
        throw error;
      }
    }
  }

  throw lastError || new Error("Unable to complete the request.");
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs?.[0] || null;
}

async function safeSendMessage(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    return null;
  }
}

async function ensureContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content/content.js"]
    });
  } catch {
    // Ignore reinjection failures for restricted pages.
  }
}

async function requestPageContext(tabId, tabUrl, forceRefresh = false) {
  const session = ensureSessionUrl(tabId, tabUrl);
  if (!forceRefresh && session.pageContext) {
    return session.pageContext;
  }

  let response = await safeSendMessage(tabId, {
    type: "GET_STRUCTURED_PAGE_DATA"
  });

  if (!response?.ok) {
    await ensureContentScript(tabId);
    response = await safeSendMessage(tabId, {
      type: "GET_STRUCTURED_PAGE_DATA"
    });
  }

  if (response?.ok && response.pageContext) {
    session.pageContext = clonePageContext(response.pageContext);
    return session.pageContext;
  }

  return session.pageContext;
}

async function getConversation(forceRefresh = false) {
  const tab = await getActiveTab();
  if (!tab?.id) {
    throw new Error("No active tab found.");
  }

  if (/^(chrome|chrome-extension|edge|about):/i.test(tab.url || "")) {
    const session = ensureSessionUrl(tab.id, tab.url || "");
    return {
      tabId: tab.id,
      pageContext: session.pageContext,
      chatHistory: sanitizeHistory(session.chatHistory),
      pageTitle: tab.title || ""
    };
  }

  const pageContext = await requestPageContext(tab.id, tab.url || "", forceRefresh);
  const session = ensureSessionUrl(tab.id, tab.url || "");

  return {
    tabId: tab.id,
    pageContext,
    chatHistory: sanitizeHistory(session.chatHistory),
    pageTitle: tab.title || pageContext?.title || ""
  };
}

async function handleChatMessage(userInput) {
  const question = normalizeText(userInput);
  if (!question) {
    throw new Error("Enter a message first.");
  }

  const tab = await getActiveTab();
  if (!tab?.id) {
    throw new Error("No active tab found.");
  }

  const session = ensureSessionUrl(tab.id, tab.url || "");
  const pageContext = await requestPageContext(tab.id, tab.url || "", false);
  if (!pageContext?.formFields?.length) {
    throw new Error("No form fields were detected on this page. Open a page with a form and refresh context.");
  }

  const history = sanitizeHistory(session.chatHistory);
  const messages = buildMessages(pageContext, history, question);

  appendHistory(tab.id, "user", question);

  try {
    const data = await callBackend(messages);
    const answer = extractAssistantContent(data);

    if (!answer) {
      throw new Error("The AI returned an empty response.");
    }

    const fillPlan = parseFillPlan(answer);
    const fillResponse = await safeSendMessage(tab.id, {
      type: "FILL_FORM_STEPS",
      steps: fillPlan.steps
    });

    if (!fillResponse?.ok) {
      throw new Error(fillResponse?.error || "The form could not be filled on the page.");
    }

    const summary = summarizeFillResult(fillResponse);
    appendHistory(tab.id, "assistant", summary);

    return {
      tabId: tab.id,
      pageContext: session.pageContext,
      chatHistory: sanitizeHistory(session.chatHistory),
      answer: summary
    };
  } catch (error) {
    session.chatHistory = sanitizeHistory(
      session.chatHistory.filter((entry, index, entries) => {
        if (index !== entries.length - 1) {
          return true;
        }
        return !(entry.role === "user" && entry.content === question);
      })
    );
    throw error;
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo.url) {
    return;
  }

  const session = resetSession(tabId, changeInfo.url);
  if (tab?.title && !session.pageContext) {
    session.pageContext = null;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabSessions.delete(tabId);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message?.type) {
    return;
  }

  (async () => {
    if (message.type === "page:contextUpdated") {
      if (sender?.tab?.id != null) {
        const session = ensureSessionUrl(sender.tab.id, sender.tab.url || "");
        session.pageContext = clonePageContext(message.pageContext);
      }

      sendResponse({ ok: true });
      return;
    }

    if (message.type === "assistant:getConversation") {
      const conversation = await getConversation(Boolean(message.forceRefresh));
      sendResponse({ ok: true, ...conversation });
      return;
    }

    if (message.type === "assistant:sendMessage") {
      const result = await handleChatMessage(message.input);
      sendResponse({ ok: true, ...result });
      return;
    }

    if (message.type === "assistant:refreshContext") {
      const conversation = await getConversation(true);
      sendResponse({ ok: true, ...conversation });
      return;
    }

    if (message.type === "assistant:newChat") {
      const tab = await getActiveTab();
      if (!tab?.id) {
        throw new Error("No active tab found.");
      }

      const session = ensureSessionUrl(tab.id, tab.url || "");
      clearChatHistory(tab.id);
      sendResponse({
        ok: true,
        tabId: tab.id,
        pageContext: session.pageContext,
        chatHistory: []
      });
      return;
    }

    sendResponse({ ok: false, error: `Unsupported message type: ${message.type}` });
  })().catch((error) => {
    sendResponse({
      ok: false,
      error: normalizeText(error?.message) || "Unknown error"
    });
  });

  return true;
});
