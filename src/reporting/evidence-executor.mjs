import { parseAnalysisDataset, summarizeRecordsByGroup } from "../analysis/disparity-analyzer.mjs";

const ACS_YEAR = "2022";
const ACS_TIMEOUT_MS = 12000;
const ACS_VARIABLES = {
  population: "B01003_001E",
  occupiedHousingUnits: "B25003_001E",
  renterOccupiedHousingUnits: "B25003_003E",
  medianHouseholdIncome: "B19013_001E"
};

export async function executeLeadEvidence({ csvText, filename, lead, analysis }) {
  const parsed = parseAnalysisDataset(csvText, filename);
  const summary = summarizeRecordsByGroup(
    parsed.records,
    lead.comparison.groupColumn,
    lead.comparison.metricColumn
  );
  const strongest = summary.groups.find((group) => group.value === lead.comparison.highestGroup);
  const weakest = summary.groups.find((group) => group.value === lead.comparison.lowestGroup);

  if (!strongest || !weakest) {
    return unsupportedEvidenceResult(
      "The tool could not rebuild the selected lead from the current dataset rows."
    );
  }

  const zipLead = detectZipLead(lead, parsed.records);
  if (!zipLead.supported) {
    return unsupportedEvidenceResult(zipLead.reason, buildCommonUncertainty(lead));
  }

  const zipBaselines = await fetchAcsZipBaselines([strongest.value, weakest.value]);
  const highestBaseline = zipBaselines.get(strongest.value);
  const lowestBaseline = zipBaselines.get(weakest.value);

  if (!highestBaseline || !lowestBaseline) {
    return unsupportedEvidenceResult(
      "The prototype could identify a ZIP-code lead, but it could not retrieve usable Census baseline rows for both comparison groups.",
      buildCommonUncertainty(lead)
    );
  }

  const denominatorChoice = chooseDenominator(lead, highestBaseline, lowestBaseline);
  const normalizedComparison = buildNormalizedComparison({
    lead,
    strongest,
    weakest,
    highestBaseline,
    lowestBaseline,
    denominatorChoice
  });
  const effectAssessment = assessEffectOnLead({ lead, strongest, weakest, normalizedComparison });

  return {
    supported: true,
    workflow: "ZIP code + Census ACS baseline",
    originalSignal: {
      headline: lead.headline,
      patternFound: lead.patternFound,
      groupColumn: lead.comparison.groupColumn,
      metricColumn: lead.comparison.metricColumn,
      highestGroup: strongest.value,
      highestMean: strongest.mean,
      highestCount: strongest.count,
      lowestGroup: weakest.value,
      lowestMean: weakest.mean,
      lowestCount: weakest.count
    },
    secondaryDatasets: [
      {
        title: `Census ACS ${ACS_YEAR} 5-year ZIP code baseline`,
        source: "U.S. Census Bureau",
        joinKey: `Primary dataset ${lead.comparison.groupColumn} values matched to ZIP Code Tabulation Area`,
        fieldsUsed: [
          "Total population",
          "Occupied housing units",
          "Renter-occupied housing units",
          "Median household income"
        ],
        limitation:
          "ACS ZIP-level estimates are modeled survey products and may not line up exactly with the administrative time period or case population in the primary dataset."
      }
    ],
    addedContext: {
      denominator: normalizedComparison.denominator,
      comparisonSummary: normalizedComparison.summary,
      baselineRows: [
        formatBaselineRow(strongest.value, highestBaseline),
        formatBaselineRow(weakest.value, lowestBaseline)
      ],
      contextualNotes: buildContextualNotes({
        lead,
        highestBaseline,
        lowestBaseline,
        denominatorChoice
      })
    },
    effectAssessment,
    remainingUncertainty: uniqueItems([
      ...buildCommonUncertainty(lead),
      denominatorChoice.type === "none"
        ? "The current execution path could only add contextual ACS data, not a direct denominator-based rate."
        : null,
      "The prototype only supports explicit ZIP-code comparisons in this first version, so broader geographic or institutional joins still require manual reporting work."
    ])
  };
}

function detectZipLead(lead, records) {
  const groupColumn = lead.comparison.groupColumn || "";
  if (!/(^|_)(zip|zipcode|postal|postal_code|zip_code)(_|$)/i.test(groupColumn)) {
    return {
      supported: false,
      reason: "This first execution path only supports leads grouped by an explicit ZIP-code column."
    };
  }

  const usableValues = records
    .map((record) => normalizeZip(record[groupColumn]))
    .filter(Boolean);

  if (!usableValues.length) {
    return {
      supported: false,
      reason: "The selected lead uses a ZIP-like column name, but the underlying values do not look like valid 5-digit ZIP codes."
    };
  }

  return { supported: true };
}

async function fetchAcsZipBaselines(groupValues) {
  const zipCodes = uniqueItems(groupValues.map(normalizeZip));
  const baselines = await Promise.all(zipCodes.map((zip) => fetchSingleZipBaseline(zip)));
  return new Map(baselines.filter(Boolean).map((item) => [item.zip, item]));
}

async function fetchSingleZipBaseline(zip) {
  if (!zip) {
    return null;
  }

  const url = new URL(`https://api.census.gov/data/${ACS_YEAR}/acs/acs5`);
  url.searchParams.set(
    "get",
    [
      "NAME",
      ACS_VARIABLES.population,
      ACS_VARIABLES.occupiedHousingUnits,
      ACS_VARIABLES.renterOccupiedHousingUnits,
      ACS_VARIABLES.medianHouseholdIncome
    ].join(",")
  );
  url.searchParams.set("for", `zip code tabulation area:${zip}`);

  const payload = await fetchJson(url.toString());
  if (!Array.isArray(payload) || payload.length < 2) {
    return null;
  }

  const headers = payload[0];
  const row = payload[1];
  const values = Object.fromEntries(headers.map((header, index) => [header, row[index]]));
  const occupied = toNumber(values[ACS_VARIABLES.occupiedHousingUnits]);
  const renters = toNumber(values[ACS_VARIABLES.renterOccupiedHousingUnits]);

  return {
    zip,
    name: values.NAME || zip,
    population: toNumber(values[ACS_VARIABLES.population]),
    occupiedHousingUnits: occupied,
    renterOccupiedHousingUnits: renters,
    renterShare: occupied > 0 ? renters / occupied : null,
    medianHouseholdIncome: toNumber(values[ACS_VARIABLES.medianHouseholdIncome])
  };
}

function chooseDenominator(lead, highestBaseline, lowestBaseline) {
  const text = `${lead.headline} ${lead.patternFound} ${lead.comparison.metricColumn}`.toLowerCase();

  if (/(housing|rent|tenant|evict|landlord|property|building)/i.test(text)) {
    if (highestBaseline.renterOccupiedHousingUnits > 0 && lowestBaseline.renterOccupiedHousingUnits > 0) {
      return {
        type: "renter_households",
        label: "Rate per 1,000 renter households",
        scale: 1000,
        getValue: (baseline) => baseline.renterOccupiedHousingUnits
      };
    }
  }

  if (highestBaseline.population > 0 && lowestBaseline.population > 0) {
    return {
      type: "population",
      label: "Rate per 10,000 residents",
      scale: 10000,
      getValue: (baseline) => baseline.population
    };
  }

  return {
    type: "none",
    label: "Context only",
    scale: null,
    getValue: () => null
  };
}

function buildNormalizedComparison({
  lead,
  strongest,
  weakest,
  highestBaseline,
  lowestBaseline,
  denominatorChoice
}) {
  if (denominatorChoice.type === "none" || !isCountLikeMetric(lead.comparison.metricColumn)) {
    return {
      denominator: denominatorChoice.label,
      summary:
        "The added Census data provides geographic context, but this first version could not compute a direct denominator-adjusted rate for the selected metric.",
      strongestRate: null,
      weakestRate: null,
      rateRatio: null
    };
  }

  const highDenominator = denominatorChoice.getValue(highestBaseline);
  const lowDenominator = denominatorChoice.getValue(lowestBaseline);

  if (!(highDenominator > 0) || !(lowDenominator > 0)) {
    return {
      denominator: denominatorChoice.label,
      summary:
        "The added Census data was fetched, but at least one comparison group is missing the denominator needed for a rate calculation.",
      strongestRate: null,
      weakestRate: null,
      rateRatio: null
    };
  }

  const strongestRate = (strongest.mean / highDenominator) * denominatorChoice.scale;
  const weakestRate = (weakest.mean / lowDenominator) * denominatorChoice.scale;
  const rateRatio = weakestRate > 0 ? strongestRate / weakestRate : null;

  return {
    denominator: denominatorChoice.label,
    strongestRate,
    weakestRate,
    rateRatio,
    summary: `${strongest.value} is estimated at ${formatMetric(strongestRate)} versus ${formatMetric(weakestRate)} for ${weakest.value} when the metric is normalized as ${denominatorChoice.label.toLowerCase()}.`
  };
}

function assessEffectOnLead({ lead, strongest, weakest, normalizedComparison }) {
  const rawRatio = weakest.mean > 0 ? strongest.mean / weakest.mean : null;

  if (normalizedComparison.rateRatio === null) {
    return {
      label: "Complicates",
      reasoning:
        "The added baseline provides useful geographic context, but this first execution path could not produce a direct adjusted comparison for the selected metric."
    };
  }

  if (normalizedComparison.rateRatio >= 1.15) {
    return {
      label: "Strengthens",
      reasoning: `After normalization, ${strongest.value} still looks higher than ${weakest.value} on ${lead.comparison.metricColumn}, so the original signal appears more resilient to baseline context.`
    };
  }

  if (normalizedComparison.rateRatio < 1 || (rawRatio && normalizedComparison.rateRatio <= rawRatio * 0.6)) {
    return {
      label: "Weakens",
      reasoning: `Once a baseline is applied, the original raw gap between ${strongest.value} and ${weakest.value} shrinks substantially or reverses, which makes the lead less stable.`
    };
  }

  return {
    label: "Complicates",
    reasoning:
      "The baseline-adjusted comparison still points in the same direction, but the gap narrows enough that the lead should be treated as provisional rather than reinforced."
  };
}

function buildContextualNotes({ lead, highestBaseline, lowestBaseline, denominatorChoice }) {
  const notes = [
    `${highestBaseline.zip} median household income: ${formatCurrency(highestBaseline.medianHouseholdIncome)}; ${lowestBaseline.zip}: ${formatCurrency(lowestBaseline.medianHouseholdIncome)}.`,
    highestBaseline.renterShare !== null && lowestBaseline.renterShare !== null
      ? `${highestBaseline.zip} renter share: ${formatPercent(highestBaseline.renterShare)}; ${lowestBaseline.zip}: ${formatPercent(lowestBaseline.renterShare)}.`
      : null,
    denominatorChoice.type === "population"
      ? "Population normalization is only a rough benchmark. It does not measure who was actually exposed to the program, service, or enforcement process."
      : null,
    denominatorChoice.type === "renter_households"
      ? "Renter-household normalization is a housing-oriented benchmark, but it still does not prove the cases in the primary dataset were distributed proportionally across all renters."
      : null
  ];

  return uniqueItems(notes);
}

function buildCommonUncertainty(lead) {
  return [
    "This cross-dataset step adds context. It does not verify the lead or establish causation.",
    `The primary signal still depends on the quality and comparability of ${lead.comparison.metricColumn} across ${lead.comparison.groupColumn} values.`,
    "A reporter still needs to confirm definitions, time coverage, and whether important cases or records are missing from either source."
  ];
}

function unsupportedEvidenceResult(reason, remainingUncertainty = []) {
  return {
    supported: false,
    workflow: "ZIP code + Census ACS baseline",
    reason,
    remainingUncertainty: uniqueItems([
      reason,
      ...remainingUncertainty
    ])
  };
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ACS_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Secondary dataset request failed (${response.status}).`);
    }

    return await response.json();
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Secondary dataset request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeZip(value) {
  const match = String(value || "").match(/(\d{5})/);
  return match ? match[1] : null;
}

function isCountLikeMetric(metricColumn) {
  return /(count|total|request|case|violation|complaint|incident|stop|arrest|filing|application|permit|inspection)/i.test(
    metricColumn
  );
}

function toNumber(value) {
  const numeric = Number(String(value ?? "").replace(/[$,]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function formatBaselineRow(groupValue, baseline) {
  return `${groupValue}: population ${formatInteger(baseline.population)}, renter households ${formatInteger(
    baseline.renterOccupiedHousingUnits
  )}, median household income ${formatCurrency(baseline.medianHouseholdIncome)}.`;
}

function formatInteger(value) {
  return Number.isFinite(value) ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value) : "Unavailable";
}

function formatCurrency(value) {
  return Number.isFinite(value)
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
      }).format(value)
    : "Unavailable";
}

function formatPercent(value) {
  return Number.isFinite(value)
    ? new Intl.NumberFormat("en-US", {
        style: "percent",
        maximumFractionDigits: 1
      }).format(value)
    : "Unavailable";
}

function formatMetric(value) {
  return Number.isFinite(value)
    ? new Intl.NumberFormat("en-US", {
        maximumFractionDigits: value >= 100 ? 0 : 2
      }).format(value)
    : "Unavailable";
}

function uniqueItems(values) {
  return [...new Set(values.filter(Boolean))];
}
