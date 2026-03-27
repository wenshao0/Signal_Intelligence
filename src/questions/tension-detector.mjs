const PRICE_MOVE_PATTERNS = /(shares?|stock|valuation|multiple).*(rose|jumped|surged|gained|fell|slid|dropped|plunged)|stock (rose|fell)|shares (rose|fell)/i;
const EXPECTATION_PATTERNS = /(expectation|consensus|forecast|guidance|estimate|target|outlook|expected return)/i;
const IMPACT_UNCLEAR_PATTERNS =
  /(no financial terms|no revenue impact|financial impact (is )?unclear|did not disclose financial terms|not expected to be material|too early to tell)/i;
const PEER_PATTERNS = /(peer|competitor|sector|industry|benchmark|relative to others|relative to peers)/i;
const FINANCIAL_STRESS_PATTERNS = /(cash|liquidity|debt|leverage|coverage|margin|burn|working capital)/i;

export function detectTensions({ page = {}, anchorEvent = null, structuredSignals = [] } = {}) {
  const text = [page.title, page.selectedText, page.articleText].filter(Boolean).join(" ");
  const tensions = [];

  if (PRICE_MOVE_PATTERNS.test(text) && EXPECTATION_PATTERNS.test(text)) {
    tensions.push("Market reaction appears to be moving faster than the current expectation or consensus frame.");
  }

  if (anchorEvent?.eventType && ["partnership_announcement", "product_or_strategy"].includes(anchorEvent.eventType) && IMPACT_UNCLEAR_PATTERNS.test(text)) {
    tensions.push("The event is concrete, but the financial impact still looks under-specified.");
  }

  if (structuredSignals.some((signal) => signal.storyFamily === "outlier_peer_deviation")) {
    tensions.push("Supporting table evidence points to company-specific divergence rather than a purely sector-wide move.");
  }

  if (structuredSignals.some((signal) => signal.storyFamily === "benchmark_gap")) {
    tensions.push("Supporting table evidence suggests expectations and current performance may be out of sync.");
  }

  if (structuredSignals.some((signal) => signal.storyFamily === "financial_health") && !FINANCIAL_STRESS_PATTERNS.test(text)) {
    tensions.push("The visible narrative may underplay balance-sheet, cash, or margin pressure showing up in the structured data.");
  }

  if (!tensions.length && anchorEvent?.eventType === "price_move") {
    tensions.push("The price move is visible, but the mechanism linking the event to earnings or valuation is not yet explicit.");
  }

  if (!tensions.length && PEER_PATTERNS.test(text)) {
    tensions.push("The page implies a peer comparison, but it is not yet clear what company-specific factor explains the gap.");
  }

  if (!tensions.length && anchorEvent) {
    tensions.push("There is a concrete business event here, but the path from the event to operating or market impact still needs explanation.");
  }

  return [...new Set(tensions)].slice(0, 4);
}
