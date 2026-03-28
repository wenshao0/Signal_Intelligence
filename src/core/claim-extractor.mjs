const CAUSAL_PATTERNS = /(causes?|leads? to|results? in|drives?|explains?|rewires?|changes?|makes? people|turns? into)/i;
const GENERALIZATION_PATTERNS = /(everyone|always|never|people|humans|the brain|we all|in general|typically)/i;
const EVIDENCE_PATTERNS = /(study|research|scientists|evidence|paper|experiment|review|neuroscience|psychology)/i;

export function extractClaimContext({ page = {}, userQuestion = "" } = {}) {
  const selectedText = clean(page.selectedText);
  const title = clean(page.title);
  const articleText = clean(page.articleText);
  const firstSentence = splitSentences(articleText)[0] || "";
  const mainClaim = selectedText || title || firstSentence || clean(userQuestion);
  const combined = [title, selectedText, articleText].filter(Boolean).join(" ");
  const confidenceFlags = [];
  const missingSupport = [];

  if (CAUSAL_PATTERNS.test(combined)) {
    confidenceFlags.push("The page uses causal or explanatory language.");
    missingSupport.push("Check whether the underlying evidence is correlational, experimental, or only suggestive.");
  }

  if (GENERALIZATION_PATTERNS.test(combined)) {
    confidenceFlags.push("The page uses broad generalization language.");
    missingSupport.push("Check whether the claim generalizes beyond the original study population.");
  }

  if (!EVIDENCE_PATTERNS.test(combined)) {
    missingSupport.push("The page does not clearly point to a specific study or evidence base yet.");
  }

  return {
    mainClaim,
    confidenceFlags,
    missingSupport
  };
}

function splitSentences(text) {
  return String(text || "")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => clean(sentence))
    .filter(Boolean);
}

function clean(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}
