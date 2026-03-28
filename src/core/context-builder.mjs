import { extractAnchorEvent } from "../questions/anchor-extractor.mjs";
import { detectTensions } from "../questions/tension-detector.mjs";

export function buildContext({ page = {}, userQuestion = "" } = {}) {
  const anchor = extractAnchorEvent({ page, userQuestion });
  const tensions = detectTensions({ page, anchorEvent: anchor.anchorEvent, structuredSignals: [] });

  return {
    anchor: anchor.anchorEvent?.statement || userQuestion || page.title || "",
    summary: buildSummary(page, anchor),
    tensions,
    timeline: anchor.timelineHints || [],
    anchorEvent: anchor.anchorEvent || null
  };
}

function buildSummary(page, anchor) {
  if (anchor.anchorEvent?.statement) {
    return anchor.anchorEvent.statement;
  }

  if (page.selectedText) {
    return trim(page.selectedText);
  }

  if (page.title) {
    return trim(page.title);
  }

  return "No clear page summary was extracted.";
}

function trim(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}
