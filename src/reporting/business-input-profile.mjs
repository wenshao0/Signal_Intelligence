const BUSINESS_GROUP_PATTERNS =
  /(^|_)(ticker|issuer|company|company_name|peer|competitor|sector|industry|segment|division|business_unit|product|brand|category|channel|store|branch|location|market|region|country|customer_cohort|cohort|customer_tier)(_|$)/i;
const BENCHMARK_PATTERNS =
  /(benchmark|target|budget|forecast|guidance|consensus|estimate|expected|plan|quota|attainment|variance|gap|vs_target|vs_budget|vs_plan|vs_consensus)/i;
const FINANCIAL_PATTERNS =
  /(revenue|sales|gross_margin|operating_margin|net_margin|margin|ebitda|profit|income|cash|cash_flow|free_cash_flow|debt|leverage|liquidity|current_ratio|quick_ratio|coverage|yield|turnover)/i;
const OPERATING_PATTERNS =
  /(retention|churn|conversion|utilization|occupancy|inventory|pricing|average_order|traffic|demand|consumption|kwh|kw|same_store|comparable_sales|headcount|capex|marketing|ad_spend)/i;
const TIME_PATTERNS =
  /(^|_)(quarter|year|month|period|fiscal|calendar|date|timestamp|qoq|yoy|mom)(_|$)|(_at$)/i;

export function buildBusinessInputProfile({ headers = [], detectedColumns = {}, auxiliaryColumns = {} }) {
  const groupColumns = detectedColumns.groupColumns || [];
  const metricColumns = detectedColumns.metricColumns || [];
  const timeColumns = auxiliaryColumns.timeColumns || detectedColumns.timeColumns || [];

  const businessGroups = groupColumns.filter((column) => BUSINESS_GROUP_PATTERNS.test(column));
  const benchmarkMetrics = metricColumns.filter((column) => BENCHMARK_PATTERNS.test(column));
  const financialMetrics = metricColumns.filter((column) => FINANCIAL_PATTERNS.test(column));
  const operatingMetrics = metricColumns.filter((column) => OPERATING_PATTERNS.test(column));
  const explicitTimeColumns = [
    ...new Set([...timeColumns, ...headers.filter((column) => TIME_PATTERNS.test(column))])
  ];

  const inputTypes = [];

  if (businessGroups.length && benchmarkMetrics.length) {
    inputTypes.push("expectation_table");
  }
  if (businessGroups.length && financialMetrics.length) {
    inputTypes.push("financial_table");
  }
  if (businessGroups.length && operatingMetrics.length) {
    inputTypes.push("operating_metrics");
  }
  if (businessGroups.length && explicitTimeColumns.length && (financialMetrics.length || operatingMetrics.length)) {
    inputTypes.push("time_series");
  }
  if (/ticker|peer|competitor|company|company_name|issuer/i.test(groupColumns.join(" "))) {
    inputTypes.push("peer_comparison");
  }

  const uniqueTypes = [...new Set(inputTypes)];
  const supported = uniqueTypes.length > 0;

  return {
    supported,
    inputTypes: uniqueTypes,
    businessGroups,
    benchmarkMetrics,
    financialMetrics,
    operatingMetrics,
    timeColumns: explicitTimeColumns,
    reasoning: supported
      ? buildSupportedReasoning(uniqueTypes, businessGroups, benchmarkMetrics, financialMetrics, operatingMetrics, explicitTimeColumns)
      : "This version works best with structured business-style inputs such as peer comparison tables, financial statement tables, operating metrics, or expectation-versus-actual tables."
  };
}

function buildSupportedReasoning(types, groups, benchmarkMetrics, financialMetrics, operatingMetrics, timeColumns) {
  const parts = [];

  if (groups.length) {
    parts.push(`business grouping fields detected: ${groups.slice(0, 3).join(", ")}`);
  }
  if (benchmarkMetrics.length) {
    parts.push(`expectation metrics detected: ${benchmarkMetrics.slice(0, 3).join(", ")}`);
  }
  if (financialMetrics.length) {
    parts.push(`financial metrics detected: ${financialMetrics.slice(0, 3).join(", ")}`);
  }
  if (operatingMetrics.length) {
    parts.push(`operating metrics detected: ${operatingMetrics.slice(0, 3).join(", ")}`);
  }
  if (timeColumns.length) {
    parts.push(`time fields detected: ${timeColumns.slice(0, 3).join(", ")}`);
  }

  return `Business-style input detected for ${types.join(", ")}. ${parts.join(" · ")}`.trim();
}
