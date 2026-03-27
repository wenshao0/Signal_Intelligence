export const EXPLANATION_FAMILY_CATALOG = {
  benchmark_gap: {
    label: "Expectation reset",
    cue: "The event may matter because expectations appear to be moving faster than the old baseline."
  },
  financial_health: {
    label: "Financial fragility",
    cue: "The event may be exposing or amplifying underlying stress in cash, leverage, or margins."
  },
  trend_break: {
    label: "Structural shift",
    cue: "The event may sit on top of a broader break in the recent operating trend."
  },
  outlier_peer_deviation: {
    label: "Peer divergence",
    cue: "The event may matter because the company appears to be diverging from peers in a way that needs explanation."
  },
  strategy_operating_mismatch: {
    label: "Strategy shift",
    cue: "The event may signal a deeper change in strategy or value-chain position than the surface headline implies."
  }
};

const FAMILY_PATTERNS = {
  benchmark_gap: /(guidance|forecast|outlook|estimate|consensus|benchmark|target|budget|expectation|valuation|multiple|re-rating)/i,
  financial_health: /(cash|cash flow|liquidity|debt|leverage|coverage|margin pressure|burn|working capital|refinanc|runway)/i,
  trend_break: /(trend|run rate|accelerat|slowdown|rebound|break from|inflection|yoy|qoq|mom|same-store|comparable sales)/i,
  outlier_peer_deviation: /(peer|competitor|sector|industry|relative to peers|outlier|benchmark against)/i,
  strategy_operating_mismatch: /(partnership|integration|platform|bundle|value chain|expansion|product mix|pricing power|roadmap|distribution|channel)/i
};

export function routeMechanisms({
  page = {},
  anchorEvent = null,
  coreQuestion = "",
  tensions = [],
  structuredSignals = [],
  maxMechanisms = 2
} = {}) {
  const text = [page.title, page.selectedText, page.articleText, coreQuestion, tensions.join(" ")].join(" ");
  const scores = new Map(Object.keys(EXPLANATION_FAMILY_CATALOG).map((family) => [family, 0]));

  for (const family of Object.keys(EXPLANATION_FAMILY_CATALOG)) {
    if (FAMILY_PATTERNS[family].test(text)) {
      scores.set(family, (scores.get(family) || 0) + 2);
    }
  }

  if (anchorEvent?.eventType === "partnership_announcement" || anchorEvent?.eventType === "product_or_strategy") {
    scores.set("strategy_operating_mismatch", (scores.get("strategy_operating_mismatch") || 0) + 3);
    scores.set("benchmark_gap", (scores.get("benchmark_gap") || 0) + 1);
  }

  if (anchorEvent?.eventType === "price_move") {
    scores.set("benchmark_gap", (scores.get("benchmark_gap") || 0) + 2);
    scores.set("outlier_peer_deviation", (scores.get("outlier_peer_deviation") || 0) + 1);
  }

  if (anchorEvent?.eventType === "earnings_release" || anchorEvent?.eventType === "guidance_change") {
    scores.set("benchmark_gap", (scores.get("benchmark_gap") || 0) + 2);
    scores.set("trend_break", (scores.get("trend_break") || 0) + 1);
  }

  for (const signal of structuredSignals) {
    if (signal.storyFamily) {
      const boost = signal.directMatch ? 3 : 2;
      scores.set(signal.storyFamily, (scores.get(signal.storyFamily) || 0) + boost);
    }
  }

  const chosen = [...scores.entries()]
    .filter(([, score]) => score >= 2)
    .sort((left, right) => right[1] - left[1])
    .slice(0, maxMechanisms)
    .map(([family, score], index) => ({
      family,
      role: index === 0 ? "primary" : "secondary",
      label: EXPLANATION_FAMILY_CATALOG[family].label,
      routingScore: score,
      cue: EXPLANATION_FAMILY_CATALOG[family].cue
    }));

  if (!chosen.length && structuredSignals.length) {
    const fallbackSignal = structuredSignals[0];
    return [
      {
        family: fallbackSignal.storyFamily,
        role: "primary",
        label: EXPLANATION_FAMILY_CATALOG[fallbackSignal.storyFamily]?.label || "Business explanation",
        routingScore: fallbackSignal.promiseScore || 2,
        cue:
          EXPLANATION_FAMILY_CATALOG[fallbackSignal.storyFamily]?.cue ||
          "Supporting structured evidence points to a business explanation worth checking."
      }
    ];
  }

  return chosen;
}
