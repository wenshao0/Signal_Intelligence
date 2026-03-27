import { inspectCsvText } from "../analysis/disparity-analyzer.mjs";
import { previewDataset } from "./ingestion.mjs";
import { buildDatasetValidationGuidance } from "../reporting/validation-planner.mjs";

export async function enrichDatasetsWithReview(candidates) {
  return Promise.all(candidates.map(async (candidate) => ({ ...candidate, review: await reviewDataset(candidate) })));
}

async function reviewDataset(candidate) {
  const sourceType = candidate.sourceType || classifySourceType(candidate.publisher, candidate.metadataUrl, candidate.source);
  const freshness = formatFreshness(candidate.freshness || null);
  const preview = await previewDataset(candidate);
  const inspection = preview.sampled && preview.csvText ? inspectCsvText(preview.csvText, `${candidate.title}-preview.csv`) : null;
  const limitations = uniqueItems([
    ...(inspection?.limitations || []),
    ...(preview.limitations || []),
    ...(candidate.suitability?.selectable ? [] : [candidate.suitability.reason])
  ]).slice(0, 5);

  const reliability = assessReliability({
    sourceType,
    format: candidate.format,
    freshness,
    inspection,
    preview,
    selectable: candidate.suitability?.selectable
  });

  const dataQuality = {
    rowCount: preview.rowCount ?? null,
    sampledRowCount: inspection?.dataset.rowCount ?? null,
    missingness: inspection
      ? `${inspection.missingness.totalMissingPercent.toFixed(1)}% missing cells in sampled rows`
      : "Unavailable",
    likelyGroupColumns: inspection?.likelyGroupColumns.slice(0, 5) || [],
    likelyMetricColumns: inspection?.likelyMetricColumns.slice(0, 5) || [],
    likelyGeographicColumns: inspection?.likelyGeographicColumns.slice(0, 5) || [],
    likelyTimeColumns: inspection?.likelyTimeColumns.slice(0, 5) || [],
    businessInputProfile: inspection?.businessInputProfile || {
      supported: false,
      inputTypes: [],
      reasoning: "This version works best with structured business-style inputs such as peer comparison tables, financial statement tables, operating metrics, or expectation-versus-actual tables."
    },
    limitations,
    usability: assessUsability({
      selectable: candidate.suitability?.selectable,
      preview,
      inspection,
      limitations
    })
  };

  return {
    dataFormat: candidate.format,
    sourceCredibility: {
      publisher: candidate.publisher || "Unknown",
      sourceType,
      freshness,
      heuristicReliability: reliability
    },
    dataQuality,
    validationPlanner: buildDatasetValidationGuidance(candidate, {
      sourceCredibility: {
        publisher: candidate.publisher || "Unknown",
        sourceType,
        freshness,
        heuristicReliability: reliability
      },
      dataQuality
    })
  };
}

function assessReliability({ sourceType, format, freshness, inspection, preview, selectable }) {
  let score = 0;
  const notes = [];

  if (sourceType === "government") {
    score += 3;
    notes.push("government publisher");
  } else if (sourceType === "academic") {
    score += 2;
    notes.push("academic publisher");
  } else if (sourceType === "nonprofit") {
    score += 1;
    notes.push("nonprofit publisher");
  } else if (sourceType === "private") {
    notes.push("private publisher");
  } else {
    notes.push("publisher type unclear");
  }

  if (/csv|json/i.test(format || "")) {
    score += 1;
    notes.push("structured format");
  }

  if (freshness.date) {
    score += 1;
    notes.push("freshness metadata available");
    if (freshness.ageDays !== null && freshness.ageDays <= 365) {
      score += 1;
      notes.push("recently updated");
    } else if (freshness.ageDays !== null && freshness.ageDays > 730) {
      score -= 2;
      notes.push("stale update history");
    } else if (freshness.ageDays !== null && freshness.ageDays > 365) {
      score -= 1;
      notes.push("older update history");
    }
  }

  if (preview.sampled) {
    score += 1;
    notes.push("sampled successfully");
  }

  if (inspection?.likelyGroupColumns.length) {
    score += 1;
    notes.push("group fields detected");
  }

  if (inspection?.likelyMetricColumns.length) {
    score += 1;
    notes.push("numeric fields detected");
  }

  if (!selectable) {
    score -= 2;
  }

  if (inspection && inspection.missingness.totalMissingPercent >= 25) {
    score -= 1;
    notes.push("notable missingness");
  }

  if (inspection && !inspection.likelyMetricColumns.length) {
    score -= 1;
  }

  const level = score >= 6 ? "Higher" : score >= 4 ? "Moderate" : "Lower";
  let reasoning = "Heuristic judgment based on source metadata and whether the tool could inspect a structured sample.";

  if (level === "Higher") {
    reasoning = `Heuristic only: ${notes.slice(0, 4).join(", ")}.`;
  } else if (level === "Moderate") {
    reasoning = "Heuristic only: promising source metadata is present, but follow-up validation is still needed before relying on the dataset.";
  } else if (!selectable) {
    reasoning = "Heuristic only: the catalog entry is visible, but the tool could not confirm a dependable structured dataset path.";
  } else if (!preview.sampled) {
    reasoning = "Heuristic only: publisher metadata is visible, but the tool could not inspect a usable sample within prototype limits.";
  }

  return {
    level,
    reasoning
  };
}

function assessUsability({ selectable, preview, inspection, limitations }) {
  if (!selectable) {
    return {
      status: "Not suitable",
      reasoning: "The dataset does not expose a supported structured download path in the current prototype."
    };
  }

  if (!preview.sampled || !inspection) {
    return {
      status: "Maybe suitable",
      reasoning: "The source looks structured, but the tool could not inspect enough sample data to judge disparity-analysis readiness."
    };
  }

  if (!inspection.likelyGroupColumns.length || !inspection.likelyMetricColumns.length) {
    return {
      status: "Not suitable",
      reasoning: "The sampled rows did not show both plausible group fields and plausible numeric outcome fields for this business-reporting prototype."
    };
  }

  if (!inspection.businessInputProfile?.supported) {
    return {
      status: "Maybe suitable",
      reasoning: inspection.businessInputProfile?.reasoning || "This version needs structured business-style input to generate strong hypotheses."
    };
  }

  if (inspection.dataset.rowCount < 25 || inspection.missingness.totalMissingPercent >= 25 || limitations.length) {
    return {
      status: "Maybe suitable",
      reasoning: "The sampled rows show some usable business structure, but limitations in size, missingness, or schema complexity may weaken hypothesis generation."
    };
  }

  return {
    status: "Suitable for business hypothesis generation",
    reasoning: "The sampled rows look like structured business-style input with plausible grouping and financial or operating metrics."
  };
}

function classifySourceType(publisher, metadataUrl, source) {
  const haystack = `${publisher || ""} ${metadataUrl || ""} ${source || ""}`.toLowerCase();

  if (haystack.includes(".gov") || /\bcity\b|\bcounty\b|\bstate\b|\bfederal\b|\bdepartment\b|\bpublic\b/.test(haystack)) {
    return "government";
  }
  if (haystack.includes(".edu") || /\buniversity\b|\bcollege\b|\binstitute\b/.test(haystack)) {
    return "academic";
  }
  if (/\bnonprofit\b|\bfoundation\b|\bassociation\b|\bcenter\b/.test(haystack)) {
    return "nonprofit";
  }
  if (/\binc\b|\bllc\b|\bcorp\b|\bcompany\b/.test(haystack)) {
    return "private";
  }

  return "unknown";
}

function formatFreshness(freshness) {
  if (!freshness?.raw) {
    return {
      date: null,
      label: "Not provided",
      ageDays: null
    };
  }

  const date = new Date(freshness.raw);
  if (Number.isNaN(date.getTime())) {
    return {
      date: null,
      label: freshness.raw,
      ageDays: null
    };
  }

  const ageMs = Date.now() - date.getTime();
  const ageDays = Math.max(0, Math.round(ageMs / (1000 * 60 * 60 * 24)));

  return {
    date: date.toISOString(),
    label: date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    }),
    ageDays
  };
}

function uniqueItems(values) {
  return [...new Set(values.filter(Boolean))];
}
