function parseJsonContent(content) {
  if (!content || typeof content !== "string") {
    throw new Error("LLM returned empty content");
  }

  const normalizedContent = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(normalizedContent);
  } catch (error) {
    throw new Error(`Failed to parse LLM JSON response: ${error.message}`);
  }
}

function tryParseJsonContent(content) {
  try {
    return {
      parsed: parseJsonContent(content),
      rawText: typeof content === "string" ? content.trim() : ""
    };
  } catch (_error) {
    return {
      parsed: null,
      rawText: typeof content === "string" ? content.trim() : ""
    };
  }
}

module.exports = {
  parseJsonContent,
  tryParseJsonContent
};
