import { analyzeCsvText, parseAnalysisDataset } from "../analysis/disparity-analyzer.mjs";
import { routeBusinessStoryFamily } from "../reporting/business-story-router.mjs";

export function extractStructuredSignals({ tables = [], mechanisms = [] } = {}) {
  const mechanismFamilies = new Set((mechanisms || []).map((item) => item.family).filter(Boolean));
  const signals = [];
  const tablesReviewed = [];

  for (const [index, rawTable] of tables.entries()) {
    const normalized = normalizeTable(rawTable, index);

    if (!normalized) {
      tablesReviewed.push({
        title: rawTable?.title || `Table ${index + 1}`,
        usable: false,
        reason: "The table could not be normalized into a structured CSV input."
      });
      continue;
    }

    try {
      const parsed = parseAnalysisDataset(normalized.csvText, normalized.title);
      const profile = parsed.businessInputProfile;
      const peerFallbackSignals = buildPeerComparisonSignals(parsed, normalized, mechanismFamilies);

      if (!profile.supported && !peerFallbackSignals.length) {
        tablesReviewed.push({
          title: normalized.title,
          usable: false,
          reason: profile.reasoning,
          inputTypes: profile.inputTypes || []
        });
        continue;
      }

      const rankedSignals = peerFallbackSignals.length
        ? peerFallbackSignals
        : mapAnalysisSignals(analyzeCsvText(normalized.csvText, normalized.title), normalized, rawTable, mechanismFamilies);

      signals.push(...rankedSignals);
      tablesReviewed.push({
        title: normalized.title,
        usable: true,
        reason: peerFallbackSignals.length
          ? "Peer-comparison fallback: one row per company can still provide supporting evidence when the table compares business metrics across entities."
          : profile.reasoning,
        inputTypes: profile.inputTypes || (peerFallbackSignals.length ? ["peer_comparison"] : []),
        signalCount: rankedSignals.length
      });
    } catch (error) {
      tablesReviewed.push({
        title: normalized.title,
        usable: false,
        reason: error instanceof Error ? error.message : "Structured signal extraction failed."
      });
    }
  }

  return {
    signals: signals
      .sort((left, right) => {
        if (left.directMatch !== right.directMatch) {
          return Number(right.directMatch) - Number(left.directMatch);
        }
        return right.promiseScore - left.promiseScore;
      })
      .slice(0, 4),
    tablesReviewed
  };
}

function mapAnalysisSignals(analysis, normalized, rawTable, mechanismFamilies) {
  return (analysis.leads || [])
    .map((lead) => ({
      id: `${normalized.id}:${lead.storyFamily}:${lead.comparison.groupColumn}:${lead.comparison.metricColumn}`,
      tableId: normalized.id,
      tableTitle: normalized.title,
      tableSource: rawTable?.source || "page_table",
      storyFamily: lead.storyFamily,
      directMatch: mechanismFamilies.has(lead.storyFamily),
      promiseScore: lead.promiseScore,
      headline: lead.headline,
      summary: lead.patternFound,
      whyItMayMatter: lead.whyItMayMatter,
      lead,
      analysis
    }))
    .sort((left, right) => {
      if (left.directMatch !== right.directMatch) {
        return Number(right.directMatch) - Number(left.directMatch);
      }
      return right.promiseScore - left.promiseScore;
    })
    .slice(0, 2);
}

function buildPeerComparisonSignals(parsed, normalized, mechanismFamilies) {
  const entityColumn = parsed.headers.find((header) => /(ticker|company|company_name|issuer|peer|competitor)/i.test(header));
  if (!entityColumn || parsed.records.length < 3) {
    return [];
  }

  const metricColumns = parsed.headers.filter(
    (header) =>
      header !== entityColumn &&
      parsed.records.some((record) => Number.isFinite(Number(record[header]))) &&
      /(revenue|sales|growth|margin|cash|cash_flow|liquidity|current_ratio|quick_ratio|debt|leverage|coverage|expected|estimate|forecast|guidance|target|benchmark|variance|gap|return|utilization|occupancy|conversion|yield|pricing)/i.test(
        header
      )
  );

  const signals = [];

  for (const metricColumn of metricColumns) {
    const numericRows = parsed.records
      .map((record) => ({
        entity: String(record[entityColumn] || "").trim(),
        value: Number(record[metricColumn])
      }))
      .filter((item) => item.entity && Number.isFinite(item.value))
      .sort((left, right) => left.value - right.value);

    if (numericRows.length < 3) {
      continue;
    }

    const weakest = numericRows[0];
    const strongest = numericRows[numericRows.length - 1];
    const overall = numericRows.reduce((sum, item) => sum + item.value, 0) / numericRows.length;
    const relativeDiff = Math.abs(strongest.value - weakest.value) / Math.max(Math.abs(overall), 1);
    if (relativeDiff < 0.15) {
      continue;
    }

    const businessStory = routeBusinessStoryFamily({
      groupColumn: entityColumn,
      metricColumn,
      groupProfile: { semanticType: "entity" },
      metricProfile: {
        semanticType: /(cash|liquidity|debt|leverage|coverage|margin|growth|revenue|sales|return|pricing|yield)/i.test(
          metricColumn
        )
          ? "substantive_outcome"
          : "numeric_measure"
      },
      strongest: { value: strongest.entity, mean: strongest.value },
      weakest: { value: weakest.entity, mean: weakest.value },
      direction: strongest.value >= weakest.value ? "higher" : "lower",
      auxiliaryColumns: { timeColumns: parsed.detectedColumns?.timeColumns || [] },
      allColumns: parsed.headers
    });

    if (!businessStory) {
      continue;
    }

    const promiseScore = Math.min(95, Math.round(relativeDiff * 70 + 30));
    const lead = {
      rank: 1,
      promiseScore,
      headline: businessStory.headline,
      hypothesis: businessStory.hypothesis,
      patternFound: `${strongest.entity} is ${formatNumber(strongest.value)} on ${humanize(metricColumn).toLowerCase()}, versus ${formatNumber(weakest.value)} for ${weakest.entity}.`,
      whyItMayMatter: businessStory.whyItMayMatter,
      possibleWeaknesses: businessStory.possibleWeaknesses,
      moreDataNeeded: businessStory.moreDataNeeded,
      whoToInterview: businessStory.whoToInterview,
      storyFamily: businessStory.family,
      comparison: {
        groupColumn: entityColumn,
        metricColumn,
        highestGroup: strongest.entity,
        lowestGroup: weakest.entity
      }
    };

    const analysis = {
      dataset: parsed.dataset,
      detectedColumns: {
        groupColumns: [entityColumn],
        metricColumns: [metricColumn],
        timeColumns: parsed.detectedColumns?.timeColumns || [],
        geographicColumns: []
      }
    };

    signals.push({
      id: `${normalized.id}:${lead.storyFamily}:${entityColumn}:${metricColumn}`,
      tableId: normalized.id,
      tableTitle: normalized.title,
      tableSource: "page_table",
      storyFamily: lead.storyFamily,
      directMatch: mechanismFamilies.has(lead.storyFamily),
      promiseScore,
      headline: lead.headline,
      summary: lead.patternFound,
      whyItMayMatter: lead.whyItMayMatter,
      lead,
      analysis
    });
  }

  return signals
    .sort((left, right) => {
      if (left.directMatch !== right.directMatch) {
        return Number(right.directMatch) - Number(left.directMatch);
      }
      return right.promiseScore - left.promiseScore;
    })
    .slice(0, 2);
}

function normalizeTable(table, index) {
  if (typeof table?.csvText === "string" && table.csvText.trim()) {
    return {
      id: table.id || `table-${index + 1}`,
      title: table.title || `Table ${index + 1}`,
      csvText: table.csvText.trim()
    };
  }

  if (Array.isArray(table?.headers) && Array.isArray(table?.rows) && table.headers.length) {
    return {
      id: table.id || `table-${index + 1}`,
      title: table.title || `Table ${index + 1}`,
      csvText: serializeCsv(table.headers, table.rows)
    };
  }

  return null;
}

function serializeCsv(headers, rows) {
  const lines = [headers.map(escapeCell).join(",")];

  for (const row of rows) {
    const normalizedRow = headers.map((_, index) => escapeCell(row?.[index]));
    lines.push(normalizedRow.join(","));
  }

  return lines.join("\n");
}

function escapeCell(value) {
  const stringValue = String(value ?? "");
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function humanize(column) {
  return String(column || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return "n/a";
  }

  if (Math.abs(value) >= 100 || Number.isInteger(value)) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }

  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
