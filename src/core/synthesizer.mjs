export function synthesizeEvidenceCase({ question = {}, context = {}, evidence = [] } = {}) {
  const top = evidence.slice(0, 3);
  const lead = top[0];

  return {
    shortAnswer: buildShortAnswer(question, lead),
    explanation: top.map((item) => item.summary).filter(Boolean).slice(0, 3),
    whatSupportsIt: top.map((item) => item.whyRelevant).filter(Boolean).slice(0, 3),
    whatWeakensIt: uniqueList(top.flatMap((item) => item.strength?.limitations || [])).slice(0, 4),
    whatIsUncertain: buildUncertainty(top),
    howItRelatesToThePage: buildPageConnection(question, context, top)
  };
}

function buildShortAnswer(question, lead) {
  if (!lead) {
    return `No strong research-backed answer was found yet for: ${question.normalized || "this question"}`;
  }

  return `The strongest relevant paper in this first pass suggests a useful angle on "${question.normalized || "this question"}", but the evidence still needs to be read with study-type and population limits in mind.`;
}

function buildUncertainty(top) {
  const items = [
    "This first slice is based on metadata and abstract-level evidence, not full-text review.",
    ...uniqueList(top.flatMap((item) => item.confidenceNotes || [])).slice(0, 3)
  ];

  return uniqueList(items).slice(0, 4);
}

function buildPageConnection(question, context, top) {
  if (!top.length) {
    return ["The current page raised a question, but the tool did not find enough strong research evidence yet."];
  }

  return [
    `The page appears to be asking: ${question.normalized || context.anchor || "What does this mean?"}`,
    `The top retrieved paper is relevant because ${top[0].whyRelevant || "it overlaps closely with that question."}`
  ];
}

function uniqueList(values) {
  return [...new Set((values || []).filter(Boolean))];
}
