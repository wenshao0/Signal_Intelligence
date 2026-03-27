import { analyzeCsvText } from "../analysis/disparity-analyzer.mjs";
import { previewDataset } from "../datasets/ingestion.mjs";
import { buildLeadValidationGuidance } from "./validation-planner.mjs";
import { executeLeadEvidence } from "./evidence-executor.mjs";

const MAX_SCREENED_DATASETS = 4;
const MAX_DISCOVERY_HYPOTHESES = 2;
const MAX_SECONDARY_EXECUTIONS = 2;
const MIN_DISCOVERY_PROMISE_SCORE = 75;

export async function buildDiscoveryHypotheses(candidates) {
  const shortlist = candidates
    .filter(
      (candidate) =>
        candidate?.suitability?.selectable &&
        candidate?.review?.dataQuality?.businessInputProfile?.supported
    )
    .slice(0, MAX_SCREENED_DATASETS);
  const hypotheses = [];
  let evidenceBudget = MAX_SECONDARY_EXECUTIONS;

  for (const candidate of shortlist) {
    const preview = await previewDataset(candidate);
    if (!preview.sampled || !preview.csvText) {
      continue;
    }

    let analysis;
    try {
      analysis = analyzeCsvText(preview.csvText, `${candidate.title}-preview.csv`);
    } catch (error) {
      continue;
    }

    const lead =
      analysis.leads.find((item) => item.editorialAssessment?.quality !== "tentative") ||
      analysis.leads[0];
    if (
      !lead ||
      lead.promiseScore < MIN_DISCOVERY_PROMISE_SCORE ||
      lead.editorialAssessment?.quality !== "strong"
    ) {
      continue;
    }

    const validationPlanner = buildLeadValidationGuidance({
      lead,
      analysis,
      discoveryReview: candidate.review || null
    });

    let evidence = null;
    if (evidenceBudget > 0) {
      try {
        evidence = await executeLeadEvidence({
          csvText: preview.csvText,
          filename: `${candidate.title}-preview.csv`,
          lead,
          analysis
        });
        evidenceBudget -= 1;
      } catch (error) {
        evidence = null;
      }
    }

    hypotheses.push(buildHypothesisSummary({
      candidate,
      lead,
      validationPlanner,
      evidence
    }));

    if (hypotheses.length >= MAX_DISCOVERY_HYPOTHESES) {
      break;
    }
  }

  return hypotheses;
}

function buildHypothesisSummary({ candidate, lead, validationPlanner, evidence }) {
  const triage = buildDiscoveryTriage({ candidate, lead, validationPlanner, evidence });
  const sourceCredibility = candidate.review?.sourceCredibility || {};
  const dataQuality = candidate.review?.dataQuality || {};
  const contributingDatasets = [
    {
      role: "Primary signal",
      title: candidate.title,
      source: candidate.source,
      note: "This dataset produced the initial observed pattern during lightweight screening.",
      metadataUrl: candidate.metadataUrl || null
    },
    ...((evidence?.secondaryDatasets || []).map((item) => ({
      role: evidence?.effectAssessment?.label === "Weakens" ? "Complicating context" : "Secondary context",
      title: item.title,
      source: item.source,
      note: item.limitation,
      metadataUrl: null
    })))
  ];

  return {
    id: `${candidate.id}:${lead.comparison.groupColumn}:${lead.comparison.metricColumn}`,
    candidateId: candidate.id,
    headline: lead.headline,
    hypothesisStatement: lead.hypothesis,
    whyItMayMatter: lead.whyItMayMatter,
    originalSignal: lead.patternFound,
    triage,
    currentEvidenceSummary: summarizeCurrentEvidence(lead, evidence),
    supportingSummary: summarizeSupportingEvidence(lead, evidence),
    conflictingSummary: summarizeConflictingEvidence(lead, validationPlanner, evidence),
    stillNeedsVerification: uniqueItems([
      ...(validationPlanner.missingFieldsOrComparisons || []).slice(0, 3),
      ...(validationPlanner.followUpDataSuggestions || []).slice(0, 2)
    ]),
    cannotYetConclude: uniqueItems([
      ...(validationPlanner.claimLimitations || []).slice(0, 3),
      ...(evidence?.remainingUncertainty || []).slice(0, 2)
    ]),
    contributingDatasets,
    datasetSupport: {
      sourceCredibility: sourceCredibility.heuristicReliability?.reasoning || "No source-credibility reasoning available.",
      dataUsability: dataQuality.usability?.reasoning || candidate.suitability?.reason || "No data-usability reasoning available.",
      qualitySignals: formatQualitySignals(dataQuality),
      limitations: dataQuality.limitations?.length
        ? dataQuality.limitations
        : ["No major structural issues flagged in the previewed sample."]
    },
    sourceMetadata: {
      title: candidate.title,
      source: candidate.source,
      metadataUrl: candidate.metadataUrl || null
    }
  };
}

function buildDiscoveryTriage({ candidate, lead, validationPlanner, evidence }) {
  let score = 0;
  const credibility = candidate.review?.sourceCredibility?.heuristicReliability?.level || "";
  const usability = candidate.review?.dataQuality?.usability?.status || "";

  if (lead.promiseScore >= 75) {
    score += 3;
  } else if (lead.promiseScore >= 60) {
    score += 2;
  } else {
    score += 1;
  }

  if (/higher/i.test(credibility)) {
    score += 1;
  } else if (/lower/i.test(credibility)) {
    score -= 1;
  }

  if (/suitable/i.test(usability)) {
    score += 1;
  } else if (/not suitable/i.test(usability)) {
    score -= 2;
  }

  const limitationCount = validationPlanner.claimLimitations?.length || 0;
  if (limitationCount >= 4) {
    score -= 2;
  } else if (limitationCount >= 2) {
    score -= 1;
  }

  if (evidence?.supported) {
    if (evidence.effectAssessment?.label === "Strengthens") {
      score += 2;
    } else if (evidence.effectAssessment?.label === "Weakens") {
      score -= 2;
    } else if (evidence.effectAssessment?.label === "Complicates") {
      score -= 1;
    }
  }

  let label = "Promising but needs validation";
  if (score >= 5) {
    label = "Strong candidate";
  } else if (score <= 1) {
    label = "Weak / tentative";
  }

  return {
    label,
    rationale: buildDiscoveryRationale(label, lead, evidence, validationPlanner)
  };
}

function buildDiscoveryRationale(label, lead, evidence, validationPlanner) {
  if (lead.editorialAssessment?.quality === "strong" && !evidence?.supported) {
    return "Clear business signal with a plausible reporting angle. It still needs fuller validation before you treat it as a real company or sector story.";
  }

  if (evidence?.supported && evidence.effectAssessment?.label === "Strengthens") {
    return "Clear business signal plus useful secondary context. This looks worth a closer reporting review.";
  }

  if (evidence?.supported && evidence.effectAssessment?.label === "Weakens") {
    return "Interesting first business signal, but added context makes it less stable. Keep it tentative.";
  }

  if (evidence?.supported && evidence.effectAssessment?.label === "Complicates") {
    return "The signal is interesting, but secondary context makes the business story direction less clean.";
  }

  if ((validationPlanner.claimLimitations?.length || 0) >= 4) {
    return "There may be a business story here, but the preview still leaves too much uncertainty for a strong editorial push.";
  }

  if (lead.promiseScore >= 60) {
    return "The preview shows a clear business pattern, but it still needs fuller validation.";
  }

  return "This is a plausible business reporting idea from the previewed data, but it remains tentative.";
}

function summarizeCurrentEvidence(lead, evidence) {
  if (evidence?.supported) {
    return `Primary signal plus ${evidence.secondaryDatasets.length} secondary dataset source. Added context ${evidence.effectAssessment.label.toLowerCase()} the hypothesis.`;
  }

  return `The current evidence comes from a lightweight screen of one dataset preview: ${lead.patternFound}`;
}

function summarizeSupportingEvidence(lead, evidence) {
  if (evidence?.supported && evidence.effectAssessment?.label === "Strengthens") {
    return `${evidence.addedContext.comparisonSummary} The secondary context points in the same direction as the original signal.`;
  }

  return `The initial support is the observed pattern in the primary dataset preview: ${lead.patternFound}`;
}

function summarizeConflictingEvidence(lead, validationPlanner, evidence) {
  if (evidence?.supported && ["Weakens", "Complicates"].includes(evidence.effectAssessment?.label)) {
    return evidence.effectAssessment.reasoning;
  }

  return (
    validationPlanner.claimLimitations?.[0] ||
    validationPlanner.cautionAndValidationNotes?.[0] ||
    lead.possibleWeaknesses
  );
}

function formatQualitySignals(dataQuality = {}) {
  const parts = [];

  if (dataQuality.rowCount !== null && dataQuality.rowCount !== undefined) {
    parts.push(`row count ${dataQuality.rowCount}`);
  } else if (dataQuality.sampledRowCount) {
    parts.push(`sampled ${dataQuality.sampledRowCount} rows`);
  }

  if (dataQuality.missingness) {
    parts.push(dataQuality.missingness);
  }

  if (dataQuality.likelyGroupColumns?.length) {
    parts.push(`likely groups: ${dataQuality.likelyGroupColumns.join(", ")}`);
  }

  if (dataQuality.likelyMetricColumns?.length) {
    parts.push(`likely metrics: ${dataQuality.likelyMetricColumns.join(", ")}`);
  }

  return parts.join(" · ") || "No quick quality signals available.";
}

function uniqueItems(values) {
  return [...new Set(values.filter(Boolean))];
}
