export function createUnderstandingCase({
  input = {},
  question = {},
  reading = {},
  inferredQuestions = {},
  context = {},
  evidence = [],
  synthesis = {},
  nextSteps = [],
  metadata = {}
} = {}) {
  return {
    id: metadata.id || buildCaseId(question.normalized || input.userQuestion || input.pageTitle || "case"),
    input: {
      pageUrl: input.pageUrl || "",
      pageTitle: input.pageTitle || "",
      selectedText: input.selectedText || "",
      pageText: input.pageText || "",
      userQuestion: input.userQuestion || ""
    },
    reading,
    inferredQuestions,
    question,
    context,
    evidence,
    synthesis,
    nextSteps,
    metadata: {
      status: metadata.status || "ok",
      generatedAt: metadata.generatedAt || new Date().toISOString(),
      sourceTypesUsed: metadata.sourceTypesUsed || []
    }
  };
}

function buildCaseId(seed) {
  return `case_${String(seed)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48)}`;
}
