import { buildLeadValidationGuidance } from "./validation-planner.mjs";

export function assembleExplanationCase({
  page = {},
  anchor = {},
  tensions = [],
  mechanisms = [],
  structuredEvidence = {}
} = {}) {
  const signals = structuredEvidence.signals || [];
  const tablesReviewed = structuredEvidence.tablesReviewed || [];
  const explanations = mechanisms
    .map((mechanism) => buildExplanation(mechanism, { page, anchor, tensions, signals }))
    .filter(Boolean);

  return {
    anchorEvent: anchor.anchorEvent,
    coreQuestion: anchor.coreQuestion,
    timeline: anchor.timelineHints || [],
    tensions: tensions || [],
    explanations,
    supportingDatasets: buildSupportingDatasets(tablesReviewed, signals),
    structuredEvidenceSummary: buildStructuredEvidenceSummary(tablesReviewed, signals),
    methodNote:
      "This question-first prototype starts from a concrete event or question, then treats structured business tables as supporting evidence rather than the primary story engine."
  };
}

function buildExplanation(mechanism, context) {
  if (!mechanism?.family) {
    return null;
  }

  const matchedSignals = context.signals.filter((signal) => signal.storyFamily === mechanism.family);
  const bestSignal = matchedSignals[0] || null;
  const planner = bestSignal
    ? buildLeadValidationGuidance({
        lead: bestSignal.lead,
        analysis: bestSignal.analysis
      })
    : null;
  const supportingEvidence = buildSupportingEvidence(context, mechanism, bestSignal);
  const counterEvidence = buildCounterEvidence(context, mechanism, bestSignal);
  const uncertainty = buildUncertainty(context, mechanism, planner, bestSignal);
  const nextChecks = buildNextChecks(mechanism, planner, bestSignal);
  const triage = buildTriage(mechanism, bestSignal, uncertainty, supportingEvidence);

  return {
    family: mechanism.family,
    familyLabel: humanizeFamily(mechanism.family),
    role: mechanism.role,
    headline: buildHeadline(mechanism.family, context.anchor?.anchorEvent),
    statement: buildStatement(mechanism.family, context.anchor?.anchorEvent),
    whyItMayMatter: buildWhyItMayMatter(mechanism.family),
    currentEvidenceSummary: buildEvidenceSummary(bestSignal),
    supportingSummary: supportingEvidence[0]?.summary || "The page provides a concrete anchor, but supporting evidence is still thin.",
    conflictingSummary: counterEvidence[0]?.summary || "No direct counterevidence has surfaced yet, but the explanation remains provisional.",
    oneLineCaution: uncertainty[0] || "This remains a reporting aid, not a confirmed explanation.",
    stillNeedsVerification: uncertainty,
    nextChecks,
    causalChain: buildCausalChain(mechanism.family),
    supportingEvidence,
    counterEvidence,
    supportingTables: matchedSignals.map((signal) => ({
      title: signal.tableTitle,
      summary: signal.summary,
      headline: signal.headline
    })),
    triage
  };
}

function buildSupportingEvidence(context, mechanism, bestSignal) {
  const evidence = [];
  const anchorStatement = context.anchor?.anchorEvent?.statement;

  if (anchorStatement) {
    evidence.push({
      source: "page_text",
      strength: "medium",
      summary: `The page is anchored in a concrete event: ${anchorStatement}`
    });
  }

  if (bestSignal) {
    evidence.push({
      source: "table_signal",
      strength: bestSignal.promiseScore >= 75 ? "strong" : "medium",
      summary: `${bestSignal.tableTitle} adds structured support: ${bestSignal.summary}`
    });
  }

  if (!bestSignal && mechanism.cue) {
    evidence.push({
      source: "reasoning",
      strength: "weak",
      summary: mechanism.cue
    });
  }

  return evidence.slice(0, 3);
}

function buildCounterEvidence(context, mechanism, bestSignal) {
  const counter = [];
  const text = [context.page?.title, context.page?.selectedText, context.page?.articleText].join(" ");

  if (!bestSignal) {
    counter.push({
      source: "missing_structured_signal",
      strength: "medium",
      summary: "No directly matching structured business table has supported this explanation yet."
    });
  }

  if (
    ["strategy_operating_mismatch", "benchmark_gap"].includes(mechanism.family) &&
    /(no financial terms|financial impact (is )?unclear|did not disclose|not expected to be material)/i.test(text)
  ) {
    counter.push({
      source: "page_text",
      strength: "medium",
      summary: "The event is concrete, but the page does not yet show a clear financial impact."
    });
  }

  if (mechanism.family === "trend_break" && !/(quarter|year|trend|same-store|yoy|qoq|run rate)/i.test(text)) {
    counter.push({
      source: "timeline_gap",
      strength: "weak",
      summary: "The page does not yet provide enough time context to show a clean break from the prior trend."
    });
  }

  return counter.slice(0, 3);
}

function buildUncertainty(context, mechanism, planner, bestSignal) {
  const items = [];

  if (planner?.claimLimitations?.length) {
    items.push(...planner.claimLimitations.slice(0, 2));
  }

  if (planner?.missingFieldsOrComparisons?.length) {
    items.push(...planner.missingFieldsOrComparisons.slice(0, 2));
  }

  if (!bestSignal) {
    items.push("This explanation does not yet have direct structured evidence attached to it.");
  }

  if (mechanism.family === "benchmark_gap") {
    items.push("Expectation-reset explanations still need explicit evidence on what the prior baseline actually was.");
  }

  if (mechanism.family === "strategy_operating_mismatch") {
    items.push("A strategy story still needs evidence that the event can change pricing power, product mix, or revenue quality.");
  }

  return uniqueList(items).slice(0, 4);
}

function buildNextChecks(mechanism, planner, bestSignal) {
  const items = [];

  if (planner?.followUpDataSuggestions?.length) {
    items.push(...planner.followUpDataSuggestions.slice(0, 2));
  }

  if (planner?.reportingSuggestions) {
    items.push(...(planner.reportingSuggestions.interviews || []).slice(0, 1).map((item) => `Interview: ${item}`));
    items.push(
      ...(planner.reportingSuggestions.recordsOrDocuments || []).slice(0, 1).map((item) => `Check: ${item}`)
    );
  }

  if (!items.length || !bestSignal) {
    items.push(...defaultNextChecks(mechanism.family));
  }

  return uniqueList(items).slice(0, 4);
}

function buildTriage(mechanism, bestSignal, uncertainty, supportingEvidence) {
  let score = 0;

  if (bestSignal?.directMatch) {
    score += 3;
  } else if (bestSignal) {
    score += 2;
  }

  if (bestSignal?.promiseScore >= 75) {
    score += 1;
  }

  if (supportingEvidence.length >= 2) {
    score += 1;
  }

  if (uncertainty.length >= 3) {
    score -= 1;
  }

  let label = "Promising but needs validation";
  if (score >= 4) {
    label = "Strong candidate";
  } else if (score <= 1) {
    label = "Weak / tentative";
  }

  return {
    label,
    rationale: buildTriageRationale(label, mechanism.family, bestSignal)
  };
}

function buildTriageRationale(label, family, bestSignal) {
  if (label === "Strong candidate" && bestSignal?.directMatch) {
    return "Clear event anchor plus matching structured evidence. This is worth editorial attention first.";
  }

  if (label === "Weak / tentative") {
    return "The mechanism is plausible, but it still relies mostly on surface context rather than confirming evidence.";
  }

  if (family === "benchmark_gap") {
    return "Interesting expectation story, but the old baseline and the new one still need to be pinned down.";
  }

  if (family === "strategy_operating_mismatch") {
    return "The event hints at a strategic shift, but operating proof still needs to catch up.";
  }

  return "Plausible business explanation, but it still needs sharper evidence before it becomes reporting-ready.";
}

function buildStructuredEvidenceSummary(tablesReviewed, signals) {
  const usableTableCount = tablesReviewed.filter((table) => table.usable).length;
  if (!usableTableCount) {
    return "No structured business-style table on the page qualified as supporting evidence yet.";
  }

  return `${usableTableCount} supporting table${usableTableCount === 1 ? "" : "s"} qualified for business-style evidence review, producing ${signals.length} reusable structured signals.`;
}

function buildSupportingDatasets(tablesReviewed, signals) {
  return tablesReviewed.map((table) => ({
    title: table.title,
    usability: table.usable ? "Useful as supporting structured evidence" : "Not useful yet",
    note: table.reason,
    signalCount: table.signalCount || 0,
    matchingFamilies: uniqueList(
      signals.filter((signal) => signal.tableTitle === table.title).map((signal) => humanizeFamily(signal.storyFamily))
    )
  }));
}

function buildHeadline(family, anchorEvent) {
  if (family === "benchmark_gap") {
    return anchorEvent?.eventType === "price_move"
      ? "Market reaction may reflect an expectation reset"
      : "The event may matter because expectations were set on an old baseline";
  }

  if (family === "financial_health") {
    return "The event may be exposing underlying financial fragility";
  }

  if (family === "trend_break") {
    return "The event may sit on top of a broader trend break";
  }

  if (family === "outlier_peer_deviation") {
    return "The company may be diverging from peers in a way this event is surfacing";
  }

  if (anchorEvent?.eventType === "partnership_announcement") {
    return "The partnership may signal a deeper strategic upgrade than the headline suggests";
  }

  return "The event may signal a deeper strategy-and-results shift";
}

function buildStatement(family, anchorEvent) {
  const statement = trimTrailingPeriod(anchorEvent?.statement || "the anchor event");
  const eventPhrase = toEventPhrase(statement);

  if (family === "benchmark_gap") {
    return `A plausible explanation is that investors or operators are reading ${eventPhrase} as a reason to update expectations faster than analysts, targets, or prior guidance have caught up.`;
  }

  if (family === "financial_health") {
    return `A plausible explanation is that ${eventPhrase} is being interpreted through existing concerns about cash generation, leverage, or margin resilience.`;
  }

  if (family === "trend_break") {
    return `A plausible explanation is that ${eventPhrase} matters because it lands on top of a break from the prior operating trend rather than a one-off move.`;
  }

  if (family === "outlier_peer_deviation") {
    return `A plausible explanation is that ${eventPhrase} matters because the company already appears to be diverging from peers on a business metric investors watch.`;
  }

  return `A plausible explanation is that investors are reading ${eventPhrase} as a sign of a deeper change in the company's strategic position, product mix, or value-chain role than the surface headline shows.`;
}

function buildWhyItMayMatter(family) {
  const catalog = {
    benchmark_gap:
      "Expectation gaps can produce strong business stories when management, analysts, and the market are no longer working from the same baseline.",
    financial_health:
      "Financial-fragility explanations matter because they can change the meaning of a seemingly isolated event into a broader cash, leverage, or margin story.",
    trend_break:
      "Trend-break explanations matter because they can turn a headline event into evidence of a deeper operating shift or weakening model.",
    outlier_peer_deviation:
      "Peer-divergence explanations matter because they point toward company-specific execution, pricing, or strategic differences rather than broad sector noise.",
    strategy_operating_mismatch:
      "Strategy explanations matter when an event hints that the company may be moving into a more valuable position before the numbers fully show it."
  };

  return catalog[family] || "This mechanism could turn the event into a sharper business reporting direction if stronger evidence appears.";
}

function buildEvidenceSummary(bestSignal) {
  if (!bestSignal) {
    return "Right now this explanation rests mainly on the page anchor and business context. No directly matching structured table has strengthened it yet.";
  }

  return `${bestSignal.tableTitle} adds structured support through a ${humanizeFamily(bestSignal.storyFamily).toLowerCase()} signal: ${bestSignal.summary}`;
}

function buildCausalChain(family) {
  const catalog = {
    benchmark_gap: [
      "Prior expectations were set around an older baseline",
      "The event changes how the company should be interpreted",
      "Investors or operators revise the implied outlook",
      "The valuation or performance frame resets"
    ],
    financial_health: [
      "Underlying cash, leverage, or margin pressure builds",
      "The event exposes or amplifies that pressure",
      "Stakeholders reassess resilience and downside risk",
      "The business story shifts from isolated event to fragility question"
    ],
    trend_break: [
      "The prior trend weakens or reverses",
      "The event lands on top of that changing trajectory",
      "The move looks less like noise and more like a structural shift",
      "The story becomes about change in direction, not one data point"
    ],
    outlier_peer_deviation: [
      "The company separates from peers on an operating or financial metric",
      "The event draws attention to that divergence",
      "A company-specific explanation becomes more plausible",
      "The reporting question becomes why this company is different"
    ],
    strategy_operating_mismatch: [
      "The event signals a shift in position, product mix, or value-chain role",
      "That shift could improve pricing power or strategic relevance",
      "Market or industry expectations update before the financial proof is complete",
      "The reporting question becomes whether the strategy shift is real and durable"
    ]
  };

  return catalog[family] || [];
}

function defaultNextChecks(family) {
  const catalog = {
    benchmark_gap: [
      "Check analyst notes, guidance changes, and prior consensus framing.",
      "Compare the event against historical expectation resets for the same company."
    ],
    financial_health: [
      "Check recent cash-flow, debt-maturity, and liquidity disclosures.",
      "Compare the company against peers on cash, leverage, and margin resilience."
    ],
    trend_break: [
      "Check multi-quarter results to see whether this is a real inflection or noise.",
      "Check management commentary on demand, pricing, or volume shifts."
    ],
    outlier_peer_deviation: [
      "Check like-for-like peer comparisons on the same metric.",
      "Check whether geography, segment mix, or reporting definitions explain the gap."
    ],
    strategy_operating_mismatch: [
      "Check whether management describes a change in product mix, integration, or pricing power.",
      "Check whether customers, partners, or peers describe the same strategic shift."
    ]
  };

  return catalog[family] || ["Check what evidence would most directly confirm or weaken this mechanism."];
}

function humanizeFamily(family) {
  return String(family || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function uniqueList(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function trimTrailingPeriod(value) {
  return String(value || "").replace(/[.!?]+$/, "");
}

function toEventPhrase(statement) {
  if (/announced? .*partnership|partnership/i.test(statement)) {
    return "the partnership announcement";
  }

  if (/guidance|forecast|outlook/i.test(statement)) {
    return "the guidance change";
  }

  if (/earnings|results|revenue/i.test(statement)) {
    return "the earnings update";
  }

  if (/acquisition|merge|takeover|divest/i.test(statement)) {
    return "the deal";
  }

  const afterMatch = statement.match(/\bafter\b\s+(.+)$/i);
  if (afterMatch?.[1]) {
    return afterMatch[1];
  }

  const becauseMatch = statement.match(/\bbecause\b\s+(.+)$/i);
  if (becauseMatch?.[1]) {
    return becauseMatch[1];
  }

  return statement;
}
