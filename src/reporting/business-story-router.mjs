const BUSINESS_GROUP_PATTERNS =
  /(^|_)(company|company_name|ticker|issuer|peer|competitor|sector|industry|segment|division|product|category|channel|brand|market|region|country|state|store|branch|location|customer_cohort|cohort|customer_tier|subsidiary|business_unit)(_|$)/i;
const BUSINESS_GEOGRAPHY_PATTERNS =
  /(^|_)(region|market|country|state|city|district|territory)(_|$)/i;
const BENCHMARK_PATTERNS =
  /(benchmark|target|budget|forecast|guidance|consensus|estimate|expected|plan|quota|attainment|variance|gap|miss|beat|vs_plan|vs_budget|vs_target|vs_consensus)/i;
const FINANCIAL_HEALTH_PATTERNS =
  /(cash|cash_flow|free_cash_flow|liquidity|current_ratio|quick_ratio|working_capital|debt|leverage|interest_coverage|coverage|burn|runway|default|delinquen|impairment)/i;
const TREND_PATTERNS =
  /(trend|growth|decline|slowdown|acceleration|yoy|qoq|mom|change|run_rate|same_store|comparable_sales)/i;
const OUTLIER_PATTERNS =
  /(revenue|sales|growth|margin|profit|ebitda|cash|expense|cost|churn|retention|utilization|occupancy|inventory|pricing|yield|recovery|conversion|turnover|consumption|demand)/i;
const STRATEGY_DRIVER_PATTERNS =
  /(capex|headcount|marketing|ad_spend|store_count|store_openings|r_and_d|rnd|research|development|pricing|promotion|product_mix|expansion|acquisition|restructuring)/i;
const STRATEGY_OUTCOME_PATTERNS =
  /(margin|growth|profit|revenue|sales|retention|churn|utilization|occupancy|conversion|return|yield|same_store|inventory_turnover)/i;

export function routeBusinessStoryFamily(input) {
  const {
    groupColumn,
    metricColumn,
    groupProfile = {},
    metricProfile = {},
    strongest,
    weakest,
    direction,
    auxiliaryColumns = {},
    allColumns = []
  } = input;

  if (!isBusinessRelevantGroup(groupColumn, groupProfile)) {
    return null;
  }

  if (!isBusinessMetric(metricColumn, metricProfile)) {
    return null;
  }

  const family = classifyStoryFamily({
    groupColumn,
    metricColumn,
    groupProfile,
    metricProfile,
    auxiliaryColumns,
    allColumns
  });

  if (!family) {
    return null;
  }

  return {
    family,
    scoreAdjustment: familyScoreAdjustment(family),
    ...buildFamilyNarrative({
      family,
      groupColumn,
      metricColumn,
      strongest,
      weakest,
      direction
    })
  };
}

function isBusinessRelevantGroup(groupColumn, groupProfile) {
  if (BUSINESS_GROUP_PATTERNS.test(groupColumn)) {
    return true;
  }

  if (groupProfile.semanticType === "entity") {
    return /(company|brand|store|branch|location|subsidiary|business_unit|segment|division|product|channel)/i.test(groupColumn);
  }

  if (groupProfile.semanticType === "geography") {
    return BUSINESS_GEOGRAPHY_PATTERNS.test(groupColumn);
  }

  return false;
}

function isBusinessMetric(metricColumn, metricProfile) {
  if (!["substantive_outcome", "numeric_measure"].includes(metricProfile.semanticType)) {
    return false;
  }

  return (
    BENCHMARK_PATTERNS.test(metricColumn) ||
    FINANCIAL_HEALTH_PATTERNS.test(metricColumn) ||
    TREND_PATTERNS.test(metricColumn) ||
    OUTLIER_PATTERNS.test(metricColumn) ||
    STRATEGY_OUTCOME_PATTERNS.test(metricColumn)
  );
}

function classifyStoryFamily({ groupColumn, metricColumn, auxiliaryColumns = {}, allColumns = [] }) {
  const combinedColumns = [groupColumn, metricColumn, ...allColumns].join(" ").toLowerCase();

  if (BENCHMARK_PATTERNS.test(metricColumn)) {
    return "benchmark_gap";
  }

  if (FINANCIAL_HEALTH_PATTERNS.test(metricColumn)) {
    return "financial_health";
  }

  if (TREND_PATTERNS.test(metricColumn) && (auxiliaryColumns.timeColumns || []).length) {
    return "trend_break";
  }

  if (STRATEGY_OUTCOME_PATTERNS.test(metricColumn) && STRATEGY_DRIVER_PATTERNS.test(combinedColumns)) {
    return "strategy_mismatch";
  }

  if (OUTLIER_PATTERNS.test(metricColumn)) {
    return "outlier_peer_deviation";
  }

  return null;
}

function buildFamilyNarrative({ family, groupColumn, metricColumn, strongest, weakest, direction }) {
  const issue = describeBusinessIssue(metricColumn);
  const groupDimension = describeBusinessGroup(groupColumn);
  const strongestGroup = describeGroupValue(groupColumn, strongest?.value);
  const weakestGroup = describeGroupValue(groupColumn, weakest?.value);
  const directionText = direction === "lower" || direction === "better" ? "lower" : "higher";

  const catalog = {
    benchmark_gap: {
      headline: `Possible expectation gap in ${issue}`,
      hypothesis: `Preview data suggests ${strongestGroup} is running ${directionText} on ${issue} than comparable ${groupDimension}, which may point to a benchmark or target gap.`,
      whyItMayMatter: `A persistent gap between actual performance and expected performance can point reporters toward execution problems, soft demand, or unrealistic internal targets.`,
      possibleWeaknesses: `This could reflect how the benchmark was defined, segment mix, seasonality, or changes in guidance methodology rather than a genuine performance miss.`,
      moreDataNeeded: `Before advancing this lead, gather budget, target, guidance, and historical benchmark data for the same ${groupDimension}.`,
      whoToInterview: [
        "Company finance or investor-relations staff responsible for target setting",
        "Sell-side or sector analysts who follow the benchmark closely",
        "Former managers or operators who can explain how targets were set and measured"
      ]
    },
    financial_health: {
      headline: `Possible signs of financial fragility in ${issue}`,
      hypothesis: `Preview data suggests ${strongestGroup} stands out on ${issue} relative to ${weakestGroup}, which can be an early sign of financial stress.`,
      whyItMayMatter: `Weakness in liquidity, leverage, cash flow, or margins can become a business reporting lead when it starts to separate one company, segment, or market from the rest.`,
      possibleWeaknesses: `One quarter, one reporting period, or one accounting definition can distort this pattern. The signal may also reflect business mix rather than real fragility.`,
      moreDataNeeded: `Before advancing this lead, gather multi-period financial statements, debt or liquidity context, and peer comparisons for the same ${groupDimension}.`,
      whoToInterview: [
        "Credit analysts, restructuring specialists, or debt-market reporters",
        "Company finance staff or former executives familiar with cash flow and leverage",
        "Suppliers, lenders, or industry analysts who track operating stress"
      ]
    },
    trend_break: {
      headline: `Possible structural shift in ${issue}`,
      hypothesis: `Preview data suggests ${strongestGroup} may be diverging from recent ${issue} patterns more sharply than comparable ${groupDimension}.`,
      whyItMayMatter: `A break from prior trend can signal a business turning point, a weakening operating model, or a change in market demand worth reporting.`,
      possibleWeaknesses: `This can be a timing artifact if the comparison window is short, seasonal, or affected by reporting changes.`,
      moreDataNeeded: `Before advancing this lead, gather a longer time series, management commentary, and comparable trend data for the same ${groupDimension}.`,
      whoToInterview: [
        "Sector analysts who track trend shifts and inflection points",
        "Company operators or former executives who can explain recent changes",
        "Customers, suppliers, or competitors who can speak to market demand"
      ]
    },
    outlier_peer_deviation: {
      headline: `${capitalize(strongestGroup)} may be a peer outlier on ${issue}`,
      hypothesis: `Preview data suggests ${strongestGroup} is running materially ${directionText} on ${issue} than comparable ${groupDimension}.`,
      whyItMayMatter: `Outlier performance against peers can point reporters toward a company-specific execution story, a pricing issue, a margin story, or an unusual operating strategy.`,
      possibleWeaknesses: `The outlier may disappear after adjusting for scale, business mix, geography, or reporting definitions.`,
      moreDataNeeded: `Before advancing this lead, gather peer financials, denominator context, and management explanations for why ${strongestGroup} differs from peers.`,
      whoToInterview: [
        "Competitors, suppliers, or former employees who know the operating model",
        "Industry analysts who can compare peers on a like-for-like basis",
        "Company management or investor-relations staff responsible for the metric"
      ]
    },
    strategy_mismatch: {
      headline: `Possible strategy-and-results mismatch in ${issue}`,
      hypothesis: `Preview data suggests ${strongestGroup} is not translating operating inputs into ${issue} the same way comparable ${groupDimension} are.`,
      whyItMayMatter: `A mismatch between strategy signals and operating results can produce strong business reporting leads about execution, capital allocation, or product-market fit.`,
      possibleWeaknesses: `The mismatch may reflect timing, accounting treatment, or a lag between investment and results rather than a failed strategy.`,
      moreDataNeeded: `Before advancing this lead, gather strategy-related inputs, management commentary, and multi-period operating results for the same ${groupDimension}.`,
      whoToInterview: [
        "Former executives or operators familiar with the strategy",
        "Investors or analysts focused on execution and capital allocation",
        "Customers, channel partners, or competitors affected by the strategy"
      ]
    }
  };

  return catalog[family];
}

function familyScoreAdjustment(family) {
  if (family === "financial_health" || family === "benchmark_gap") {
    return 16;
  }
  if (family === "trend_break" || family === "strategy_mismatch") {
    return 12;
  }
  return 10;
}

function describeBusinessIssue(metricColumn) {
  const label = humanize(metricColumn);

  if (/gross_margin|operating_margin|ebitda_margin|net_margin|margin/i.test(metricColumn)) {
    return "margin performance";
  }
  if (/cash|cash_flow|free_cash_flow|liquidity|current_ratio|quick_ratio|working_capital/i.test(metricColumn)) {
    return "liquidity and cash health";
  }
  if (/debt|leverage|interest_coverage|coverage|default|delinquen/i.test(metricColumn)) {
    return "balance-sheet stress";
  }
  if (/guidance|forecast|target|budget|benchmark|consensus|estimate|variance|gap|attainment|quota/i.test(metricColumn)) {
    return "performance against expectations";
  }
  if (/growth|same_store|comparable_sales|sales|revenue/i.test(metricColumn)) {
    return "revenue growth";
  }
  if (/churn|retention/i.test(metricColumn)) {
    return "customer retention";
  }
  if (/utilization|occupancy|conversion|yield/i.test(metricColumn)) {
    return "operating performance";
  }
  if (/inventory/i.test(metricColumn)) {
    return "inventory efficiency";
  }
  if (/consumption|usage|demand/i.test(metricColumn)) {
    return "operating demand";
  }
  return label.toLowerCase();
}

function describeBusinessGroup(groupColumn) {
  if (/ticker|issuer|company|peer|competitor/i.test(groupColumn)) {
    return "peer companies";
  }
  if (/sector|industry/i.test(groupColumn)) {
    return "sectors";
  }
  if (/segment|division|business_unit/i.test(groupColumn)) {
    return "business segments";
  }
  if (/product|category|brand/i.test(groupColumn)) {
    return "product groups";
  }
  if (/channel/i.test(groupColumn)) {
    return "sales channels";
  }
  if (/store|branch|location/i.test(groupColumn)) {
    return "locations";
  }
  if (/region|market|country|state|city|district|territory/i.test(groupColumn)) {
    return "markets";
  }
  if (/customer_cohort|cohort|customer_tier/i.test(groupColumn)) {
    return "customer cohorts";
  }
  return `${humanize(groupColumn).toLowerCase()} groups`;
}

function describeGroupValue(groupColumn, value) {
  if (/ticker/i.test(groupColumn)) {
    return `ticker ${value}`;
  }
  if (/company|issuer|peer|competitor/i.test(groupColumn)) {
    return `${value}`;
  }
  if (/segment|division|business_unit/i.test(groupColumn)) {
    return `segment ${value}`;
  }
  if (/product|category|brand/i.test(groupColumn)) {
    return `${humanize(groupColumn).toLowerCase()} ${value}`;
  }
  if (/channel/i.test(groupColumn)) {
    return `channel ${value}`;
  }
  if (/store|branch|location/i.test(groupColumn)) {
    return `location ${value}`;
  }
  if (/region|market|country|state|city|district|territory/i.test(groupColumn)) {
    return `${humanize(groupColumn).toLowerCase()} ${value}`;
  }
  return `${value}`;
}

function humanize(text) {
  return String(text || "").replace(/_/g, " ");
}

function capitalize(text) {
  const value = String(text || "");
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}
