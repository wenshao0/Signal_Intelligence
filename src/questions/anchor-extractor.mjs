const EVENT_PATTERNS = [
  ["partnership_announcement", /(partner(ship)?|collaborat|joint venture|alliance|co-marketing|distribution deal)/i],
  ["earnings_release", /(earnings|quarterly results|annual results|reported .*revenue|reported .*earnings|guidance)/i],
  ["guidance_change", /(guidance|forecast|outlook|target|consensus|estimate).*(cut|raise|lower|lift|trim)|cuts? guidance|raises? guidance/i],
  ["acquisition_or_sale", /(acquire|acquisition|merge|merger|takeover|divest|sale of|spin-?off)/i],
  ["product_or_strategy", /(launch|rollout|integration|platform|expansion|product|roadmap|value chain|upgrade)/i],
  ["restructuring", /(layoff|restructur|cost[- ]?cut|plant closure|shutdown|bankruptcy|chapter 11)/i],
  ["financing", /(debt offering|equity offering|refinanc|credit facility|loan|funding round)/i],
  ["leadership_change", /(ceo|cfo|chair|board).*(appoint|step down|resign|leave|replace)/i],
  ["price_move", /(shares?|stock).*(rose|jumped|surged|gained|fell|slid|dropped|plunged)|stock (rose|fell)|shares (rose|fell)/i]
];

const EVENT_VERB_PATTERNS =
  /(announce|report|launch|partner|acquire|merge|cut|raise|lower|forecast|guide|surge|jump|rise|fall|drop|plunge|expand|warn|file|sign|roll out|integrate)/i;

const TIME_PATTERNS = [
  /(same day|that day|today|yesterday|this morning|this afternoon)/i,
  /(quarter|fiscal year|year over year|year-on-year|month over month|quarter over quarter)/i,
  /(after|before|following|ahead of|during|since)\b/i
];

export function extractAnchorEvent({ page = {}, userQuestion = "" } = {}) {
  const title = cleanText(page.title);
  const selectedText = cleanText(page.selectedText);
  const articleText = cleanText(page.articleText);
  const coreQuestion = cleanText(userQuestion);
  const sentences = splitSentences(articleText);
  const candidates = [selectedText, title, ...sentences.slice(0, 6)].filter(Boolean);
  const anchorStatement = candidates.find(isEventLikeSentence) || candidates[0] || "";

  if (!anchorStatement && !coreQuestion) {
    return {
      status: "needs_question",
      anchorEvent: null,
      coreQuestion: "",
      timelineHints: []
    };
  }

  const eventType = inferEventType([title, selectedText, articleText].filter(Boolean).join(" "));
  const timeReference = inferTimeReference([selectedText, ...sentences.slice(0, 4)].join(" "));
  const timelineHints = buildTimelineHints(title, sentences);

  return {
    status: "ok",
    anchorEvent: {
      statement: finalizeSentence(anchorStatement || coreQuestion),
      eventType,
      timeReference,
      source: selectedText ? "selection" : title ? "title" : "article"
    },
    coreQuestion: coreQuestion || buildCoreQuestion(anchorStatement, eventType),
    timelineHints
  };
}

function buildCoreQuestion(anchorStatement, eventType) {
  const statement = finalizeSentence(anchorStatement || "this development");

  if (eventType === "price_move") {
    return `What may explain the market reaction around ${statement.toLowerCase()}?`;
  }

  if (eventType === "partnership_announcement" || eventType === "product_or_strategy") {
    return `Why might this event matter more than the headline suggests: ${statement.toLowerCase()}?`;
  }

  return `What may explain the business significance of ${statement.toLowerCase()}?`;
}

function buildTimelineHints(title, sentences) {
  const hints = [];
  const candidates = [title, ...sentences.slice(0, 8)].filter(Boolean);

  for (const sentence of candidates) {
    if (TIME_PATTERNS.some((pattern) => pattern.test(sentence))) {
      hints.push(finalizeSentence(sentence));
    }
  }

  return [...new Set(hints)].slice(0, 3);
}

function inferEventType(text) {
  for (const [eventType, pattern] of EVENT_PATTERNS) {
    if (pattern.test(text)) {
      return eventType;
    }
  }

  return "business_event";
}

function inferTimeReference(text) {
  if (!text) {
    return null;
  }

  for (const pattern of TIME_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }

  return null;
}

function isEventLikeSentence(sentence) {
  return sentence.length >= 30 && EVENT_VERB_PATTERNS.test(sentence);
}

function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => cleanText(sentence))
    .filter(Boolean);
}

function finalizeSentence(text) {
  const clean = cleanText(text);
  if (!clean) {
    return "";
  }

  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}
