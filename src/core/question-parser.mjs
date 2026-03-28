const DOMAIN_PATTERNS = [
  [
    "psychology_neuroscience",
    /(psycholog|neurosci|brain|cognit|memory|attention|emotion|motiv|habit|behavior|behaviour|stress|anxiety|depress|sleep|decision|reward|trauma|social rejection|loneliness|learning|addiction|dopamine|serotonin|therapy|mental health)/i
  ]
];

const QUESTION_TYPE_PATTERNS = [
  ["why", /(^|\b)why\b/i],
  ["how", /(^|\b)how\b/i],
  ["is_this_true", /(is this true|does research support|is there evidence|is it true)/i],
  ["what_does_this_mean", /(what does this mean|why does this matter|what should i make of this)/i]
];

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "in",
  "on",
  "for",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "this",
  "that",
  "these",
  "those",
  "what",
  "why",
  "how",
  "most",
  "more",
  "relevant",
  "understanding",
  "research",
  "evidence",
  "study",
  "studies",
  "paper",
  "papers",
  "some",
  "actually",
  "just",
  "whether",
  "checking",
  "check",
  "claim",
  "claims",
  "supported",
  "supports",
  "support",
  "describe",
  "describes",
  "well",
  "does",
  "did",
  "do",
  "it",
  "they",
  "them",
  "their",
  "with",
  "from",
  "about",
  "into",
  "over",
  "under",
  "than",
  "then",
  "when",
  "where",
  "who",
  "whom",
  "which",
  "because",
  "after",
  "before",
  "while",
  "through",
  "people",
  "person"
]);

export function parseQuestion({ page = {}, userQuestion = "", domainHint = "" } = {}) {
  const normalized = cleanText(userQuestion) || inferQuestionFromPage(page);
  const combined = [normalized, page.title, page.selectedText, page.articleText].filter(Boolean).join(" ");
  const type = inferQuestionType(normalized || combined);
  const domain = inferDomain(domainHint || combined);
  const concepts = extractConcepts(combined);
  const entities = extractEntities(page.title, page.selectedText, page.articleText);

  return {
    normalized,
    type,
    domain,
    entities,
    concepts
  };
}

function inferQuestionFromPage(page) {
  const selected = cleanText(page.selectedText);
  if (selected) {
    return `What research is most relevant to understanding this: ${trimSentence(selected)}`;
  }

  const title = cleanText(page.title);
  if (title) {
    return `What research is most relevant to understanding this topic: ${trimSentence(title)}`;
  }

  return "";
}

function inferQuestionType(text) {
  for (const [type, pattern] of QUESTION_TYPE_PATTERNS) {
    if (pattern.test(text)) {
      return type;
    }
  }

  return "what_explains_this";
}

function inferDomain(text) {
  for (const [domain, pattern] of DOMAIN_PATTERNS) {
    if (pattern.test(text)) {
      return domain;
    }
  }

  return "unknown";
}

function extractConcepts(text) {
  const words = cleanText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word));
  const counts = new Map();

  for (const word of words) {
    counts.set(word, (counts.get(word) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => {
      const frequencyGap = right[1] - left[1];
      if (frequencyGap !== 0) {
        return frequencyGap;
      }
      return right[0].length - left[0].length;
    })
    .map(([word]) => word)
    .slice(0, 8);
}

function extractEntities(...parts) {
  const matches = parts
    .filter(Boolean)
    .flatMap((part) => String(part).match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g) || []);

  return [...new Set(matches)].slice(0, 6);
}

function trimSentence(text) {
  return String(text || "").replace(/[.!?]+$/, "");
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}
