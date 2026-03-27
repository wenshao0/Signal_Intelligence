const explainForm = document.querySelector("#explain-form");
const uploadForm = document.querySelector("#upload-form");
const discoverForm = document.querySelector("#discover-form");
const fileInput = document.querySelector("#csv-file");
const sampleButton = document.querySelector("#sample-button");
const explainSampleButton = document.querySelector("#explain-sample-button");
const statusEl = document.querySelector("#status");
const datasetsEl = document.querySelector("#datasets");
const summaryEl = document.querySelector("#summary");
const comparisonEl = document.querySelector("#comparison");
const leadsEl = document.querySelector("#hypotheses");
const developerPanelEl = document.querySelector("#developer-panel");
const developerDebugEl = document.querySelector("#developer-debug");
const leadTemplate = document.querySelector("#hypothesis-template");
const explanationTemplate = document.querySelector("#explanation-template");
const discoveryHypothesisTemplate = document.querySelector("#discovery-hypothesis-template");
const datasetTemplate = document.querySelector("#dataset-template");
const topicInput = document.querySelector("#topic-input");
const locationInput = document.querySelector("#location-input");
const explainQuestionInput = document.querySelector("#explain-question");
const explainTitleInput = document.querySelector("#explain-title");
const explainUrlInput = document.querySelector("#explain-url");
const explainSelectionInput = document.querySelector("#explain-selection");
const explainArticleInput = document.querySelector("#explain-article");
const explainTableTitleInput = document.querySelector("#explain-table-title");
const explainTableCsvInput = document.querySelector("#explain-table-csv");
const modeButtons = {
  explain: document.querySelector("#mode-explain"),
  upload: document.querySelector("#mode-upload"),
  discover: document.querySelector("#mode-discover")
};
const modePanels = {
  explain: document.querySelector("#panel-explain"),
  upload: document.querySelector("#panel-upload"),
  discover: document.querySelector("#panel-discover")
};

let discoveredCandidates = [];
let lastAnalysisSource = null;
let leadEvidenceResults = new Map();
let lastAnalysisContext = null;
let developerDebugState = {
  explain: null,
  upload: null,
  search: null,
  hypothesis: null
};

modeButtons.explain.addEventListener("click", () => setMode("explain"));
modeButtons.upload.addEventListener("click", () => setMode("upload"));
modeButtons.discover.addEventListener("click", () => setMode("discover"));

explainForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await runExplanation();
});

explainSampleButton.addEventListener("click", async () => {
  renderStatus("Loading sample explanation context...", "loading");
  const response = await fetch("/sample-data");
  const csvText = await response.text();
  explainQuestionInput.value = "Why might the market react so strongly to this partnership announcement?";
  explainTitleInput.value = "FormFactor shares rise after partnership announcement";
  explainUrlInput.value = "https://example.com/formfactor-partnership";
  explainSelectionInput.value =
    "FormFactor shares jumped after the company announced a new partnership, even though many analysts had been treating the stock as a lower-return name.";
  explainArticleInput.value =
    "FormFactor shares rose after the company announced a partnership aimed at tighter integration in RF testing. The company did not disclose an immediate revenue impact, but the market reaction suggested investors may be reading the move as strategically important. Analysts had previously framed the stock as a lower-return name relative to peers, raising the question of whether the market is updating expectations faster than published estimates.";
  explainTableTitleInput.value = "Peer comparison table";
  explainTableCsvInput.value = csvText;
  setMode("explain");
  renderStatus("Sample explanation context loaded.", "success");
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = fileInput.files?.[0];

  if (!file) {
    renderStatus("Choose a CSV file first.", "error");
    return;
  }

  const csvText = await file.text();
  await runAnalysis({ csvText, filename: file.name });
});

sampleButton.addEventListener("click", async () => {
  renderStatus("Loading sample dataset...", "loading");
  const response = await fetch("/sample-data");
  const csvText = await response.text();
  await runAnalysis({ csvText, filename: "sample-company-peer-metrics.csv" });
});

discoverForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const topic = topicInput.value.trim();
  const location = locationInput.value.trim();

  if (!topic) {
    renderStatus("Enter a topic to search supported public data catalogs.", "error");
    return;
  }

  clearResults();
  clearDatasets();
  renderStatus("Searching supported public data catalogs...", "loading");

  try {
    const response = await fetch("/api/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, location })
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Dataset discovery failed.");
    }

    discoveredCandidates = result.candidates || [];
    renderStatus(`Found ${discoveredCandidates.length} candidate datasets.`, "success");
    renderSearchDebug(result);
    renderDiscoveryHypotheses(result);
    renderDatasets(result);
  } catch (error) {
    renderStatus(error.message || "Dataset discovery failed.", "error");
  }
});

datasetsEl.addEventListener("click", async (event) => {
  const button = event.target.closest(".dataset-run");
  if (!button) {
    return;
  }

  const candidateId = button.dataset.candidateId;
  const candidate = discoveredCandidates.find((item) => item.id === candidateId);

  if (!candidate) {
    renderStatus("The selected dataset is no longer available in the current shortlist.", "error");
    return;
  }

  await runDiscoveredAnalysis(candidate);
});

leadsEl.addEventListener("click", async (event) => {
  const discoveryButton = event.target.closest(".hypothesis-run");
  if (discoveryButton) {
    const candidateId = discoveryButton.dataset.candidateId;
    const candidate = discoveredCandidates.find((item) => item.id === candidateId);

    if (!candidate) {
      renderStatus("The selected dataset is no longer available in the current shortlist.", "error");
      return;
    }

    await runDiscoveredAnalysis(candidate);
    return;
  }

  const button = event.target.closest(".lead-evidence-run");
  if (!button) {
    return;
  }

  const leadRef = {
    groupColumn: button.dataset.groupColumn,
    metricColumn: button.dataset.metricColumn
  };
  const leadKey = buildLeadKey(leadRef);

  if (!lastAnalysisSource) {
    renderStatus("Run an analysis first before attempting a cross-dataset evidence check.", "error");
    return;
  }

  button.disabled = true;
  button.textContent = "Running evidence check...";
  renderStatus("Fetching secondary public data for the selected lead...", "loading");

  try {
    const response = await fetch("/api/lead-evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: lastAnalysisSource,
        leadRef
      })
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Lead evidence check failed.");
    }

    leadEvidenceResults.set(leadKey, result.evidence);
    renderStatus("Cross-dataset evidence check complete.", "success");
    renderLeads(lastRenderedLeads);
  } catch (error) {
    button.disabled = false;
    button.textContent = "Run evidence check";
    renderStatus(error.message || "Lead evidence check failed.", "error");
  }
});

let lastRenderedLeads = [];

async function runExplanation() {
  const question = explainQuestionInput.value.trim();
  const page = {
    url: explainUrlInput.value.trim(),
    title: explainTitleInput.value.trim(),
    selectedText: explainSelectionInput.value.trim(),
    articleText: explainArticleInput.value.trim(),
    tables: []
  };
  const supportingTableCsv = explainTableCsvInput.value.trim();
  if (supportingTableCsv) {
    page.tables.push({
      title: explainTableTitleInput.value.trim() || "Supporting business table",
      csvText: supportingTableCsv
    });
  }

  if (!question && !page.title && !page.selectedText && !page.articleText) {
    renderStatus("Enter a business question, event, or page context first.", "error");
    return;
  }

  renderStatus("Building explanation paths from the page context...", "loading");
  clearResults();
  clearDatasets();
  lastAnalysisSource = null;
  lastAnalysisContext = null;
  leadEvidenceResults = new Map();

  try {
    const response = await fetch("/api/explain-page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page,
        userQuestion: question,
        options: { maxExplanations: 2 }
      })
    });

    const result = await response.json();
    if (!response.ok || result.status === "error") {
      throw new Error(result.error || "Explanation request failed.");
    }

    renderExplainDebug(result);

    if (result.status !== "ok") {
      renderStatus(result.message || "This page does not yet provide enough signal for a strong explanation.", "error");
      if (result.case) {
        renderExplanationSummary(result.case);
      }
      return;
    }

    renderStatus("Explanation paths ready.", "success");
    renderExplanationSummary(result.case);
    renderExplanationCase(result.case);
  } catch (error) {
    renderStatus(error.message || "Explanation request failed.", "error");
  }
}

async function runAnalysis(payload) {
  renderStatus("Analyzing dataset for business-reporting hypotheses...", "loading");
  clearResults();

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (!response.ok) {
      renderUploadDebug({
        ok: false,
        request: payload,
        payload: result
      });
      throw new Error(result.error || "Analysis failed.");
    }

    renderUploadDebug({
      ok: true,
      request: payload,
      payload: result
    });
    lastAnalysisSource = {
      mode: "upload",
      csvText: payload.csvText,
      filename: payload.filename
    };
    lastAnalysisContext = buildAnalysisContext(result);
    leadEvidenceResults = new Map();
    renderStatus("Analysis complete.", "success");
    renderSummary(result);
    renderComparison(result.leads);
    renderLeads(result.leads);
  } catch (error) {
    renderStatus(error.message || "Analysis failed.", "error");
  }
}

async function runDiscoveredAnalysis(candidate) {
  renderStatus(`Fetching and analyzing ${candidate.title}...`, "loading");
  clearResults();

  try {
    const response = await fetch("/api/analyze-discovered", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidate })
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Dataset analysis failed.");
    }

    lastAnalysisSource = {
      mode: "discovered",
      candidate
    };
    lastAnalysisContext = buildAnalysisContext(result);
    leadEvidenceResults = new Map();
    renderStatus("Analysis complete.", "success");
    renderSummary(result);
    renderComparison(result.leads);
    renderLeads(result.leads);
  } catch (error) {
    renderStatus(error.message || "Dataset analysis failed.", "error");
  }
}

function setMode(mode) {
  for (const [key, button] of Object.entries(modeButtons)) {
    button.classList.toggle("mode-button-active", key === mode);
    modePanels[key].classList.toggle("hidden", key !== mode);
  }
}

function renderExplanationSummary(explanationCase) {
  summaryEl.classList.remove("hidden");
  comparisonEl.classList.add("hidden");
  comparisonEl.innerHTML = "";
  datasetsEl.classList.add("hidden");
  datasetsEl.innerHTML = "";

  summaryEl.innerHTML = `
    <div class="comparison-header">
      <div>
        <p class="eyebrow">Question-first view</p>
        <h2>Event and evidence overview</h2>
        <p class="muted">The main cards below show candidate explanation paths first. Use these support layers to inspect the event anchor, tensions, and structured evidence basis.</p>
      </div>
    </div>
    <details class="support-panel" open>
      <summary>What happened</summary>
      <div class="support-body">
        <div class="summary-grid">
          <div>
            <p class="eyebrow">Anchor event</p>
            <h3>${escapeHtml(explanationCase.anchorEvent?.statement || "No anchor event extracted")}</h3>
            <p class="muted">${escapeHtml(explanationCase.anchorEvent?.eventType || "business_event")}${
              explanationCase.anchorEvent?.timeReference
                ? ` · ${escapeHtml(explanationCase.anchorEvent.timeReference)}`
                : ""
            }</p>
          </div>
          <div>
            <p class="eyebrow">Core question</p>
            <p>${escapeHtml(explanationCase.coreQuestion || "No core question generated.")}</p>
          </div>
          <div>
            <p class="eyebrow">Structured evidence</p>
            <p>${escapeHtml(explanationCase.structuredEvidenceSummary || "No supporting table review yet.")}</p>
          </div>
        </div>
      </div>
    </details>
    <details class="support-panel">
      <summary>Tensions and timeline</summary>
      <div class="support-body">
        <div class="lead-details">
          <div>
            <dt>Tensions worth explaining</dt>
            <dd>${renderBulletList(explanationCase.tensions || [])}</dd>
          </div>
          <div>
            <dt>Timeline hints</dt>
            <dd>${renderBulletList(explanationCase.timeline || [])}</dd>
          </div>
        </div>
      </div>
    </details>
    <details class="support-panel">
      <summary>Supporting tables and method note</summary>
      <div class="support-body">
        <div class="lead-details">
          <div>
            <dt>Supporting table review</dt>
            <dd>${renderSupportingDatasetList(explanationCase.supportingDatasets || [])}</dd>
          </div>
          <div>
            <dt>Method note</dt>
            <dd>${escapeHtml(explanationCase.methodNote || "No method note available.")}</dd>
          </div>
        </div>
      </div>
    </details>
  `;
}

function renderExplanationCase(explanationCase) {
  leadsEl.classList.remove("hidden");
  leadsEl.innerHTML = `
    <div class="panel leads-header">
      <div class="comparison-header">
        <div>
          <p class="eyebrow">Candidate explanations</p>
          <h2>Possible explanations to test next</h2>
          <p class="muted">These are explanation paths for the event or question you entered. They are not conclusions.</p>
        </div>
      </div>
    </div>
    <div class="lead-grid"></div>
  `;

  const grid = leadsEl.querySelector(".lead-grid");
  const explanations = explanationCase.explanations || [];

  if (!explanations.length) {
    grid.innerHTML = `
      <article class="panel lead-card">
        <h3>No explanation paths yet</h3>
        <p class="muted">The page anchor is clear enough to inspect, but the current context still does not support a strong explanation path.</p>
      </article>
    `;
    return;
  }

  for (const [index, explanation] of explanations.entries()) {
    const fragment = explanationTemplate.content.cloneNode(true);
    fragment.querySelector(".rank").textContent = explanation.role === "primary" ? "Primary" : `Secondary ${index + 1}`;
    fragment.querySelector(".triage-label").textContent = explanation.triage?.label || "Promising but needs validation";
    fragment
      .querySelector(".triage-label")
      .classList.add(triageToneFromLabel(explanation.triage?.label || "Promising but needs validation"));
    fragment.querySelector(".headline").textContent = explanation.headline;
    fragment.querySelector(".triage-rationale").textContent =
      explanation.triage?.rationale || "No editorial rationale available.";
    fragment.querySelector(".hypothesis-statement").textContent = explanation.statement;
    fragment.querySelector(".importance").textContent = explanation.whyItMayMatter;
    fragment.querySelector(".explanation-anchor").textContent =
      explanationCase.anchorEvent?.statement || explanationCase.coreQuestion || "No event anchor available.";
    fragment.querySelector(".explanation-supporting-summary").textContent =
      explanation.currentEvidenceSummary || explanation.supportingSummary;
    fragment.querySelector(".explanation-conflicting-summary").textContent = explanation.conflictingSummary;
    fragment.querySelector(".lead-caution-inline").textContent = explanation.oneLineCaution;
    fragment.querySelector(".explanation-verification-inline").textContent =
      explanation.stillNeedsVerification?.[0] || "Further verification is still required.";
    fragment.querySelector(".explanation-family").textContent = `Family: ${explanation.familyLabel}`;
    fragment.querySelector(".lead-priority-summary").textContent =
      explanation.role === "primary" ? "Check this path first" : "Useful secondary mechanism";
    fragment.querySelector(".explanation-question").textContent =
      explanationCase.coreQuestion || "No core question available.";
    fragment.querySelector(".explanation-timeline").innerHTML = renderBulletList(explanationCase.timeline || []);
    fragment.querySelector(".explanation-tensions").innerHTML = renderBulletList(explanationCase.tensions || []);
    fragment.querySelector(".explanation-causal-chain").innerHTML = renderBulletList(explanation.causalChain || []);
    fragment.querySelector(".explanation-supporting-evidence").innerHTML = renderEvidenceItems(
      explanation.supportingEvidence || []
    );
    fragment.querySelector(".explanation-counter-evidence").innerHTML = renderEvidenceItems(
      explanation.counterEvidence || []
    );
    fragment.querySelector(".explanation-next-checks").innerHTML = renderBulletList(explanation.nextChecks || []);
    fragment.querySelector(".explanation-supporting-tables").innerHTML = renderSupportingTableEvidence(
      explanation.supportingTables || []
    );
    grid.appendChild(fragment);
  }
}

function renderDatasets(result) {
  datasetsEl.classList.remove("hidden");
  const warnings = (result.warnings || [])
    .map((warning) => `<li>${escapeHtml(warning)}</li>`)
    .join("");

  datasetsEl.innerHTML = `
    <details class="support-panel">
      <summary>Supporting dataset screening and source review</summary>
      <div class="support-body">
        <div class="comparison-header">
          <div>
            <h2>Contributing datasets</h2>
            <p class="muted">
              Search: ${escapeHtml(result.query.topic)}${
                result.query.location ? ` · ${escapeHtml(result.query.location)}` : ""
              }
            </p>
          </div>
          <p class="muted">These dataset cards remain available as supporting material, but the main search results are organized as candidate hypotheses.</p>
        </div>
        ${
          warnings
            ? `<div class="dataset-warnings"><strong>Notes</strong><ul>${warnings}</ul></div>`
            : ""
        }
        <div class="dataset-grid"></div>
      </div>
    </details>
  `;

  const grid = datasetsEl.querySelector(".dataset-grid");

  if (!result.candidates.length) {
    grid.innerHTML = `
      <article class="dataset-card">
        <h3>No candidate datasets found</h3>
        <p class="muted">
          Try a broader topic, a more specific location, or upload a CSV directly.
        </p>
      </article>
    `;
    return;
  }

  for (const candidate of result.candidates) {
    const fragment = datasetTemplate.content.cloneNode(true);
    const review = candidate.review || {};
    const sourceCredibility = review.sourceCredibility || {};
    const dataQuality = review.dataQuality || {};
    const planner = review.validationPlanner || {};

    fragment.querySelector(".dataset-source").textContent = candidate.source;
    fragment.querySelector(".dataset-format").textContent = review.dataFormat || candidate.format;
    fragment.querySelector(".dataset-title").textContent = candidate.title;
    fragment.querySelector(".dataset-publisher").textContent = `Publisher: ${sourceCredibility.publisher || candidate.publisher || "Unknown"} · Source type: ${sourceCredibility.sourceType || "unknown"}`;
    const reliabilityBadge = fragment.querySelector(".dataset-reliability");
    const usabilityBadge = fragment.querySelector(".dataset-usability");
    reliabilityBadge.textContent = `Source credibility: ${sourceCredibility.heuristicReliability?.level || "Unknown"}`;
    usabilityBadge.textContent = `Usability: ${dataQuality.usability?.status || "Unknown"}`;
    applyBadgeTone(reliabilityBadge, sourceCredibility.heuristicReliability?.level);
    applyBadgeTone(usabilityBadge, dataQuality.usability?.status);
    fragment.querySelector(".dataset-freshness").textContent = `Updated: ${sourceCredibility.freshness?.label || "Not provided"}`;
    fragment.querySelector(".dataset-description").textContent = candidate.description;
    fragment.querySelector(".dataset-credibility").textContent =
      sourceCredibility.heuristicReliability?.reasoning || "No source-credibility reasoning available.";
    fragment.querySelector(".dataset-usability-detail").textContent =
      dataQuality.usability?.reasoning || candidate.suitability.reason;
    fragment.querySelector(".dataset-quality").textContent = formatQualitySignals(dataQuality);
    fragment.querySelector(".dataset-limitations").textContent =
      dataQuality.limitations?.length ? dataQuality.limitations.join("; ") : "No major structural issues flagged in the sampled review.";
    fragment.querySelector(".dataset-follow-up-data").innerHTML = renderBulletList(planner.followUpDataSuggestions);
    fragment.querySelector(".dataset-missing").innerHTML = renderBulletList(planner.missingFieldsOrComparisons);
    fragment.querySelector(".dataset-reporting").innerHTML = renderReportingSuggestions(planner.reportingSuggestions);
    fragment.querySelector(".dataset-cautions").innerHTML = renderBulletList(planner.cautionAndValidationNotes);
    const link = fragment.querySelector(".dataset-link");
    link.href = candidate.metadataUrl || "#";
    if (!candidate.metadataUrl) {
      link.classList.add("button-disabled");
      link.removeAttribute("href");
    }

    const button = fragment.querySelector(".dataset-run");
    button.dataset.candidateId = candidate.id;
    const usabilityStatus = dataQuality.usability?.status;
    const blocked = !candidate.suitability.selectable || usabilityStatus === "Not suitable";
    button.disabled = blocked;
    if (blocked) {
      button.textContent = "Not analyzable";
      button.classList.add("button-disabled");
    } else if (dataQuality.usability?.status === "Maybe suitable") {
      button.textContent = "Analyze with caution";
    }

    grid.appendChild(fragment);
  }
}

function renderDiscoveryHypotheses(result) {
  leadsEl.classList.remove("hidden");
  const hypotheses = result.hypotheses || [];
  const renderAttempts = [];

  leadsEl.innerHTML = `
    <div class="panel leads-header">
      <div class="comparison-header">
        <div>
          <p class="eyebrow">Candidate hypotheses</p>
          <h2>Topic search results</h2>
          <p class="muted">These hypotheses come from lightweight screening of the top discovered datasets. You should see possible business reporting directions first, with datasets available underneath as support.</p>
        </div>
      </div>
    </div>
    <div class="lead-grid"></div>
  `;

  const grid = leadsEl.querySelector(".lead-grid");

  if (!hypotheses.length) {
    grid.innerHTML = `
      <article class="panel lead-card">
        <h3>No candidate hypotheses yet</h3>
        <p class="muted">The system found datasets, but this version did not detect structured business-style input strong enough to produce a confident business hypothesis. Use the supporting dataset layer below or upload a company, peer, financial, or expectation table.</p>
      </article>
    `;
    developerDebugState.hypothesis = {
      hypothesisCount: 0,
      firstHypothesis: null,
      renderAttempts: ["No hypothesis objects were available to render."]
    };
    renderDeveloperPanel();
    return;
  }

  for (const hypothesis of hypotheses) {
    try {
      const fragment = discoveryHypothesisTemplate.content.cloneNode(true);
      const triageLabel = requireElement(fragment, ".triage-label");
      triageLabel.textContent = hypothesis.triage?.label || "Promising but needs validation";
      triageLabel.classList.add(triageToneFromLabel(hypothesis.triage?.label));
      requireElement(fragment, ".rank").textContent = "Preview";
      requireElement(fragment, ".headline").textContent = hypothesis.headline || "Untitled hypothesis";
      requireElement(fragment, ".triage-rationale").textContent =
        hypothesis.triage?.rationale || "No editorial rationale available.";
      requireElement(fragment, ".hypothesis-statement").textContent =
        hypothesis.hypothesisStatement || "No hypothesis statement available.";
      requireElement(fragment, ".importance").textContent =
        hypothesis.whyItMayMatter || "No business-reporting rationale available.";
      requireElement(fragment, ".hypothesis-evidence-summary").textContent =
        hypothesis.currentEvidenceSummary || "No evidence summary available.";
      requireElement(fragment, ".hypothesis-dataset-summary").textContent = (hypothesis.contributingDatasets || [])
        .map((item) => `${item.role}: ${item.title}`)
        .join("; ");
      requireElement(fragment, ".hypothesis-supporting-summary").textContent =
        hypothesis.supportingSummary || "No supporting summary available.";
      requireElement(fragment, ".hypothesis-conflicting-summary").textContent =
        hypothesis.conflictingSummary || "No conflicting summary available.";
      requireElement(fragment, ".hypothesis-verification-inline").textContent =
        hypothesis.stillNeedsVerification?.[0] || "Further verification is still required.";
      requireElement(fragment, ".pattern").textContent =
        hypothesis.originalSignal || "No original signal available.";
      requireElement(fragment, ".score").textContent = "Lightweight dataset screening";
      requireElement(fragment, ".lead-priority-summary").textContent =
        hypothesis.triage?.label === "Strong candidate"
          ? "Editorially worth checking first"
          : hypothesis.triage?.label === "Weak / tentative"
            ? "Keep it tentative until stronger evidence appears"
            : "Interesting, but still needs validation";
      requireElement(fragment, ".hypothesis-datasets").innerHTML = renderBulletList(
        (hypothesis.contributingDatasets || []).map(
          (item) => `${item.role}: ${item.title} (${item.source}). ${item.note}`
        )
      );
      requireElement(fragment, ".hypothesis-conclusions").innerHTML = renderBulletList(
        hypothesis.cannotYetConclude || []
      );
      requireElement(fragment, ".dataset-credibility").textContent =
        hypothesis.datasetSupport?.sourceCredibility || "No source-credibility detail available.";
      requireElement(fragment, ".dataset-usability-detail").textContent =
        hypothesis.datasetSupport?.dataUsability || "No data-usability detail available.";
      requireElement(fragment, ".dataset-quality").textContent =
        hypothesis.datasetSupport?.qualitySignals || "No quality signals available.";
      requireElement(fragment, ".dataset-limitations").textContent = (hypothesis.datasetSupport?.limitations || [
        "No limitations provided."
      ]).join("; ");
      requireElement(fragment, ".lead-caution-inline").textContent =
        hypothesis.cannotYetConclude?.[0] || hypothesis.conflictingSummary || "Still needs verification.";

      const runButton = requireElement(fragment, ".hypothesis-run");
      runButton.dataset.candidateId = hypothesis.candidateId || "";

      const sourceLink = requireElement(fragment, ".hypothesis-source-link");
      sourceLink.href = hypothesis.sourceMetadata?.metadataUrl || "#";
      if (!hypothesis.sourceMetadata?.metadataUrl) {
        sourceLink.classList.add("button-disabled");
        sourceLink.removeAttribute("href");
      }

      renderAttempts.push(`rendered: ${hypothesis.id || hypothesis.headline || "unknown hypothesis"}`);
      grid.appendChild(fragment);
    } catch (error) {
      renderAttempts.push(
        `skipped: ${hypothesis.id || hypothesis.headline || "unknown hypothesis"} -> ${
          error instanceof Error ? error.message : "unknown render error"
        }`
      );
      grid.appendChild(buildHypothesisFallbackCard(hypothesis, error));
    }
  }

  developerDebugState.hypothesis = {
    hypothesisCount: hypotheses.length,
    firstHypothesis: hypotheses[0] || null,
    renderAttempts
  };
  renderDeveloperPanel();
}

function renderSummary(result) {
  summaryEl.classList.remove("hidden");
  const discovery = result.discovery;
  const sourceCredibility = discovery?.review?.sourceCredibility;
  const dataQuality = discovery?.review?.dataQuality;
  summaryEl.innerHTML = `
    <div class="comparison-header">
      <div>
        <h2>Supporting layers</h2>
        <p class="muted">Hypothesis dossiers above are the primary editorial view. Open these sections for dataset basis, source review, and method transparency.</p>
      </div>
    </div>
    <details class="support-panel">
      <summary>Dataset basis</summary>
      <div class="support-body">
        <div class="summary-grid">
          <div>
            <p class="eyebrow">Analysis run</p>
            <h3>${escapeHtml(result.dataset.filename)}</h3>
            <p class="muted">${result.dataset.rowCount} rows · ${result.dataset.columnCount} columns</p>
          </div>
          <div>
            <p class="eyebrow">Detected group columns</p>
            <p>${result.detectedColumns.groupColumns.map(escapeHtml).join(", ")}</p>
          </div>
          <div>
            <p class="eyebrow">Detected metrics</p>
            <p>${result.detectedColumns.metricColumns.map(escapeHtml).join(", ")}</p>
          </div>
        </div>
        ${
          discovery
            ? `
              <div class="source-summary">
                <p class="eyebrow">Source dataset</p>
                <p><strong>${escapeHtml(discovery.title)}</strong> · ${escapeHtml(discovery.source)} · ${escapeHtml(discovery.format)}</p>
                ${
                  sourceCredibility
                    ? `<p class="muted">Source credibility: ${escapeHtml(sourceCredibility.heuristicReliability?.level || "Unknown")} · ${escapeHtml(sourceCredibility.heuristicReliability?.reasoning || "")}</p>`
                    : ""
                }
                ${
                  dataQuality
                    ? `<p class="muted">Data usability: ${escapeHtml(dataQuality.usability?.status || "Unknown")} · ${escapeHtml(dataQuality.usability?.reasoning || "")}</p>`
                    : ""
                }
                <p class="muted">${escapeHtml(discovery.normalizationNote || discovery.whyAnalyzable || "")}</p>
                ${
                  discovery.metadataUrl
                    ? `<p><a href="${escapeHtml(discovery.metadataUrl)}" target="_blank" rel="noreferrer">Open source dataset</a></p>`
                    : ""
                }
              </div>
            `
            : ""
        }
      </div>
    </details>
    <details class="support-panel">
      <summary>Method notes and limitations</summary>
      <div class="support-body">
        <p class="method-note">${escapeHtml(result.analysisFocus)}</p>
        <p class="muted">This first hypothesis workflow is intentionally narrow: one primary-dataset signal becomes a tentative hypothesis, and the system attaches secondary public evidence only when a clear comparison path exists.</p>
      </div>
    </details>
  `;
}

function renderComparison(leads) {
  comparisonEl.classList.remove("hidden");
  const rows = leads
    .map(
      (lead) => `
        <tr>
          <td>${lead.rank}</td>
          <td>${escapeHtml(lead.hypothesis)}</td>
          <td>${escapeHtml(lead.comparison.groupColumn)}</td>
          <td>${escapeHtml(lead.comparison.metricColumn)}</td>
          <td>${lead.promiseScore}</td>
        </tr>
      `
    )
    .join("");

  comparisonEl.innerHTML = `
    <details class="support-panel">
      <summary>Hypothesis comparison table</summary>
      <div class="support-body">
        <p class="muted">Use this table when an editor wants to compare candidate hypotheses before assigning follow-up reporting.</p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Hypothesis</th>
                <th>Group</th>
                <th>Metric</th>
                <th>Promise</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </details>
  `;
}

function renderLeads(leads) {
  lastRenderedLeads = leads;
  leadsEl.classList.remove("hidden");
  leadsEl.innerHTML = `
    <div class="panel leads-header">
      <div class="comparison-header">
        <div>
          <p class="eyebrow">Candidate hypotheses</p>
          <h2>Tentative hypotheses with evidence bundles</h2>
          <p class="muted">Scan these first: each card organizes the current supporting, conflicting, and unresolved evidence around one reporting hypothesis.</p>
        </div>
      </div>
    </div>
    <div class="lead-grid"></div>
  `;
  const grid = leadsEl.querySelector(".lead-grid");

  for (const lead of leads) {
    const fragment = leadTemplate.content.cloneNode(true);
    const planner = lead.validationPlanner || {};
    const baseline = planner.baselineOrDenominatorGuidance || {};
    const leadRef = {
      groupColumn: lead.comparison.groupColumn,
      metricColumn: lead.comparison.metricColumn
    };
    const evidence = leadEvidenceResults.get(buildLeadKey(leadRef));
    const triage = buildEditorialAssessment(lead, planner, evidence);
    const dossier = buildHypothesisDossier(lead, evidence, planner, lastAnalysisContext);
    fragment.querySelector(".rank").textContent = `#${lead.rank}`;
    fragment.querySelector(".triage-label").textContent = triage.label;
    fragment.querySelector(".triage-label").classList.add(triage.toneClass);
    fragment.querySelector(".triage-rationale").textContent = triage.rationale;
    fragment.querySelector(".score").textContent = `Observed signal score ${lead.promiseScore}`;
    fragment.querySelector(".lead-priority-summary").textContent = triage.prioritySummary;
    fragment.querySelector(".lead-effect").textContent = summarizeEffect(evidence);
    fragment.querySelector(".lead-effect").classList.add(effectToneClass(evidence));
    fragment.querySelector(".headline").textContent = lead.headline;
    fragment.querySelector(".hypothesis-statement").textContent = dossier.statement;
    fragment.querySelector(".hypothesis").textContent = lead.hypothesis;
    fragment.querySelector(".importance").textContent = lead.whyItMayMatter;
    fragment.querySelector(".pattern").textContent = lead.patternFound;
    fragment.querySelector(".hypothesis-evidence-summary").textContent = dossier.currentEvidenceSummary;
    fragment.querySelector(".hypothesis-supporting-summary").textContent = dossier.supportingSummary;
    fragment.querySelector(".hypothesis-conflicting-summary").textContent = dossier.conflictingSummary;
    fragment.querySelector(".lead-caution-inline").textContent = summarizeCaution(lead, planner, evidence);
    fragment.querySelector(".hypothesis-datasets").innerHTML = renderBulletList(dossier.datasetsContributingEvidence);
    fragment.querySelector(".hypothesis-verification").innerHTML = renderBulletList(dossier.stillNeedsVerification);
    fragment.querySelector(".hypothesis-conclusions").innerHTML = renderBulletList(dossier.cannotYetConclude);
    fragment.querySelector(".lead-baseline-summary").textContent =
      baseline.summary || "This lead still needs denominator, time, and comparison context before it can be advanced confidently.";
    fragment.querySelector(".lead-baseline-why").textContent =
      baseline.whyItMatters || "A visible disparity can still reflect group size, geography, or timing rather than a meaningful reporting signal.";
    fragment.querySelector(".lead-baseline-types").innerHTML =
      renderBulletList((baseline.missingContextTypes || []).map((item) => `${item}`));
    fragment.querySelector(".lead-secondary-sources").innerHTML = renderSecondarySources(
      planner.secondarySourceRecommendations
    );
    fragment.querySelector(".lead-claim-limits").innerHTML = renderBulletList(planner.claimLimitations);
    const evidenceButton = fragment.querySelector(".lead-evidence-run");
    evidenceButton.dataset.groupColumn = lead.comparison.groupColumn;
    evidenceButton.dataset.metricColumn = lead.comparison.metricColumn;
    if (leadEvidenceResults.get(buildLeadKey(leadRef))) {
      evidenceButton.textContent = "Rerun evidence check";
    }
    fragment.querySelector(".lead-evidence-result").innerHTML = renderLeadEvidenceResult(evidence);
    fragment.querySelector(".weaknesses").textContent = lead.possibleWeaknesses;
    fragment.querySelector(".more-data").textContent = lead.moreDataNeeded;
    fragment.querySelector(".interviews").textContent = lead.whoToInterview.join("; ");
    fragment.querySelector(".lead-follow-up-data").innerHTML = renderBulletList(planner.followUpDataSuggestions);
    fragment.querySelector(".lead-missing").innerHTML = renderBulletList(planner.missingFieldsOrComparisons);
    fragment.querySelector(".lead-reporting").innerHTML = renderReportingSuggestions(planner.reportingSuggestions);
    fragment.querySelector(".lead-cautions").innerHTML = renderBulletList(planner.cautionAndValidationNotes);
    grid.appendChild(fragment);
  }
}

function renderStatus(message, tone) {
  statusEl.textContent = message;
  statusEl.className = `status ${tone}`;
}

function clearDatasets() {
  datasetsEl.classList.add("hidden");
  datasetsEl.innerHTML = "";
  discoveredCandidates = [];
}

function clearResults() {
  summaryEl.classList.add("hidden");
  comparisonEl.classList.add("hidden");
  leadsEl.classList.add("hidden");
  summaryEl.innerHTML = "";
  comparisonEl.innerHTML = "";
  leadsEl.innerHTML = "";
  developerPanelEl.classList.add("hidden");
  developerDebugEl.innerHTML = "";
  developerDebugState = {
    explain: null,
    upload: null,
    search: null,
    hypothesis: null
  };
  lastRenderedLeads = [];
  lastAnalysisContext = null;
}

function renderSearchDebug(result) {
  const datasetCount = result?.candidates?.length || 0;
  const hypothesisCount = result?.hypotheses?.length || 0;
  const primaryRenderer = hypothesisCount > 0 ? "hypotheses" : "datasets";
  developerDebugState.search = {
    query: result?.query || null,
    datasetCount,
    hypothesisCount,
    primaryRenderer
  };
  renderDeveloperPanel();
}

function renderUploadDebug({ ok, request, payload }) {
  const debug = payload?.uploadDebug || {};
  developerDebugState.upload = {
    ok,
    endpoint: debug.endpoint || "POST /api/analyze",
    filename: debug.uploadedFilename || request?.filename || "uploaded.csv",
    requestBodyFields: debug.requestBodyFields || [],
    csvTextLength: debug.csvTextLength ?? 0,
    csvFirstTwoLines: debug.csvFirstTwoLines || [],
    parsedColumnNames: debug.parsedColumnNames || [],
    detectedGroupColumns: debug.detectedGroupColumns || payload?.detectedColumns?.groupColumns || [],
    detectedMetricColumns: debug.detectedMetricColumns || payload?.detectedColumns?.metricColumns || [],
    schemaInferenceSucceeded: Boolean(debug.schemaInferenceSucceeded),
    disparityAnalysisRan: Boolean(debug.disparityAnalysisRan),
    disparityAnalysisSucceeded: Boolean(debug.disparityAnalysisSucceeded),
    inferredSchema:
      debug.inferredSchema || {
        detectedColumns: payload?.detectedColumns || null,
        dataset: payload?.dataset || null
      },
    analysisInput: debug.analysisInput || null,
    error: debug.error || payload?.error || "None",
    rawPayload: payload
  };
  renderDeveloperPanel();
}

function renderExplainDebug(result) {
  const debug = result?.debug || {};
  developerDebugState.explain = {
    status: result?.status || "unknown",
    pageTitle: debug.pageTitle || "",
    questionPresent: Boolean(debug.questionPresent),
    anchorEvent: debug.anchorEvent || null,
    initialMechanisms: debug.initialMechanisms || [],
    finalMechanisms: debug.finalMechanisms || [],
    tableCount: debug.tableCount || 0,
    usableTableCount: debug.usableTableCount || 0,
    structuredSignalCount: debug.structuredSignalCount || 0
  };
  renderDeveloperPanel();
}

function formatQualitySignals(signals) {
  const parts = [];

  if (signals.rowCount !== null && signals.rowCount !== undefined) {
    parts.push(`row count ${signals.rowCount}`);
  } else if (signals.sampledRowCount) {
    parts.push(`sampled ${signals.sampledRowCount} rows`);
  } else {
    parts.push("row count unavailable");
  }

  if (signals.missingness) {
    parts.push(signals.missingness);
  }

  if (signals.likelyGroupColumns?.length) {
    parts.push(`likely groups: ${signals.likelyGroupColumns.join(", ")}`);
  } else {
    parts.push("likely groups: none detected");
  }

  if (signals.likelyMetricColumns?.length) {
    parts.push(`likely metrics: ${signals.likelyMetricColumns.join(", ")}`);
  } else {
    parts.push("likely metrics: none detected");
  }

  if (signals.likelyGeographicColumns?.length) {
    parts.push(`geography: ${signals.likelyGeographicColumns.join(", ")}`);
  }

  if (signals.likelyTimeColumns?.length) {
    parts.push(`time: ${signals.likelyTimeColumns.join(", ")}`);
  }

  return parts.join(" · ");
}

function applyBadgeTone(element, value) {
  const text = String(value || "").toLowerCase();
  element.classList.remove("badge-good", "badge-caution", "badge-bad");

  if (text.includes("higher") || text.includes("suitable for business hypothesis generation")) {
    element.classList.add("badge-good");
    return;
  }

  if (text.includes("moderate") || text.includes("maybe suitable")) {
    element.classList.add("badge-caution");
    return;
  }

  if (text.includes("lower") || text.includes("not suitable")) {
    element.classList.add("badge-bad");
  }
}

function renderBulletList(items = []) {
  const cleanItems = items.filter(Boolean);
  if (!cleanItems.length) {
    return `<p class="muted">Use the dataset dictionary, a matched denominator source, and a second public dataset before advancing.</p>`;
  }

  return `<ul class="guidance-list">${cleanItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderReportingSuggestions(reportingSuggestions = {}) {
  const items = [
    ...(reportingSuggestions.interviews || []).map((item) => `Interview: ${item}`),
    ...(reportingSuggestions.agenciesOrInstitutions || []).map((item) => `Agency or institution: ${item}`),
    ...(reportingSuggestions.recordsOrDocuments || []).map((item) => `Records or documents: ${item}`)
  ];

  return renderBulletList(items);
}

function renderSecondarySources(recommendations = []) {
  const clean = recommendations.filter(Boolean);

  if (!clean.length) {
    return `<p class="muted">No secondary-source recommendations were generated for this lead yet.</p>`;
  }

  return clean
    .map(
      (item) => `
        <article class="secondary-source-card">
          <h5>${escapeHtml(item.datasetType || "Additional dataset")}</h5>
          <p><strong>Why it is relevant:</strong> ${escapeHtml(item.relevance || "No reasoning available.")}</p>
          <p><strong>Possible join or comparison key:</strong> ${escapeHtml(item.possibleJoinKey || "A manual comparison key would be needed.")}</p>
          <p><strong>Main limitation:</strong> ${escapeHtml(item.majorLimitation || "Further reporting would still be required.")}</p>
        </article>
      `
    )
    .join("");
}

function renderEvidenceItems(items = []) {
  return renderBulletList(
    items.map((item) => {
      const parts = [];
      if (item.strength) {
        parts.push(`${capitalize(item.strength)} signal`);
      }
      if (item.source) {
        parts.push(String(item.source).replace(/_/g, " "));
      }
      const prefix = parts.length ? `${parts.join(" · ")}: ` : "";
      return `${prefix}${item.summary || ""}`.trim();
    })
  );
}

function renderSupportingDatasetList(items = []) {
  if (!items.length) {
    return `<p class="muted">No supporting tables were reviewed for this explanation request.</p>`;
  }

  return items
    .map(
      (item) => `
        <article class="secondary-source-card">
          <h5>${escapeHtml(item.title || "Supporting table")}</h5>
          <p><strong>Usability:</strong> ${escapeHtml(item.usability || "Unknown")}</p>
          <p><strong>Why:</strong> ${escapeHtml(item.note || "No note available.")}</p>
          ${
            item.matchingFamilies?.length
              ? `<p><strong>Matched families:</strong> ${escapeHtml(item.matchingFamilies.join(", "))}</p>`
              : ""
          }
        </article>
      `
    )
    .join("");
}

function renderSupportingTableEvidence(items = []) {
  if (!items.length) {
    return `<p class="muted">No directly matching structured table supported this explanation yet.</p>`;
  }

  return items
    .map(
      (item) => `
        <article class="secondary-source-card">
          <h5>${escapeHtml(item.title || "Supporting table")}</h5>
          <p>${escapeHtml(item.headline || "Structured signal")}</p>
          <p class="muted">${escapeHtml(item.summary || "")}</p>
        </article>
      `
    )
    .join("");
}

function renderLeadEvidenceResult(evidence) {
  if (!evidence) {
    return `<p class="muted">No cross-dataset execution has been run for this lead yet. This first version supports explicit ZIP-code joins to Census ACS baseline data.</p>`;
  }

  if (!evidence.supported) {
    return `
      <article class="evidence-result-card">
        <p><strong>Status:</strong> Not supported in this first execution path.</p>
        <p>${escapeHtml(evidence.reason || "No supported cross-dataset path was found.")}</p>
        ${renderInlineList("Remaining uncertainty", evidence.remainingUncertainty)}
      </article>
    `;
  }

  return `
    <article class="evidence-result-card">
      <p><strong>Workflow:</strong> ${escapeHtml(evidence.workflow)}</p>
      <p><strong>Original signal:</strong> ${escapeHtml(evidence.originalSignal.patternFound)}</p>
      <p><strong>Added context:</strong> ${escapeHtml(evidence.addedContext.comparisonSummary)}</p>
      ${renderInlineList("Baseline rows", evidence.addedContext.baselineRows)}
      ${renderInlineList("Contextual notes", evidence.addedContext.contextualNotes)}
      ${renderInlineList(
        "Secondary dataset used",
        (evidence.secondaryDatasets || []).map(
          (item) =>
            `${item.title} (${item.source}) | join key: ${item.joinKey} | limitation: ${item.limitation}`
        )
      )}
      <p><strong>Effect on lead:</strong> ${escapeHtml(evidence.effectAssessment.label)}. ${escapeHtml(
        evidence.effectAssessment.reasoning
      )}</p>
      ${renderInlineList("Remaining uncertainty", evidence.remainingUncertainty)}
    </article>
  `;
}

function renderInlineList(label, items = []) {
  const clean = items.filter(Boolean);
  if (!clean.length) {
    return "";
  }

  return `
    <div class="inline-guidance">
      <p><strong>${escapeHtml(label)}:</strong></p>
      ${renderBulletList(clean)}
    </div>
  `;
}

function buildLeadKey(leadRef) {
  return `${leadRef.groupColumn}:${leadRef.metricColumn}`;
}

function summarizeWorth(score) {
  if (score >= 75) {
    return "Higher editorial promise";
  }
  if (score >= 60) {
    return "Worth a look";
  }
  return "Tentative lead";
}

function summarizeEffect(evidence) {
  if (!evidence) {
    return "Added context not run yet";
  }
  if (!evidence.supported) {
    return "No automated cross-dataset match";
  }
  return `Added context: ${evidence.effectAssessment.label}`;
}

function effectToneClass(evidence) {
  if (!evidence?.supported) {
    return "triage-caution";
  }

  if (evidence.effectAssessment?.label === "Strengthens") {
    return "triage-good";
  }

  if (evidence.effectAssessment?.label === "Weakens") {
    return "triage-bad";
  }

  return "triage-caution";
}

function triageToneFromLabel(label) {
  if (label === "Strong candidate") {
    return "triage-good";
  }
  if (label === "Weak / tentative") {
    return "triage-bad";
  }
  return "triage-caution";
}

function summarizeEvidence(lead, evidence, baseline) {
  if (evidence?.supported) {
    return `${evidence.effectAssessment.label}: ${evidence.addedContext.comparisonSummary}`;
  }

  if (evidence && !evidence.supported) {
    return evidence.reason || "No automated cross-dataset execution path was available for this lead.";
  }

  return baseline.summary || `Original signal only so far: ${lead.patternFound}`;
}

function summarizeCaution(lead, planner, evidence) {
  if (evidence?.remainingUncertainty?.length) {
    return evidence.remainingUncertainty[0];
  }

  return (
    planner.claimLimitations?.[0] ||
    planner.cautionAndValidationNotes?.[0] ||
    lead.possibleWeaknesses
  );
}

function buildEditorialAssessment(lead, planner, evidence) {
  let score = 0;

  if (lead.promiseScore >= 75) {
    score += 3;
  } else if (lead.promiseScore >= 60) {
    score += 2;
  } else if (lead.promiseScore >= 50) {
    score += 1;
  }

  const limitationCount = planner.claimLimitations?.length || 0;
  if (limitationCount <= 1) {
    score += 1;
  } else if (limitationCount >= 4) {
    score -= 2;
  } else if (limitationCount >= 2) {
    score -= 1;
  }

  const followUpCount = planner.followUpDataSuggestions?.length || 0;
  const interviewCount = planner.reportingSuggestions?.interviews?.length || 0;
  if (followUpCount >= 2 && interviewCount >= 2) {
    score += 1;
  }

  if (evidence?.supported) {
    if (evidence.effectAssessment?.label === "Strengthens") {
      score += 2;
    } else if (evidence.effectAssessment?.label === "Complicates") {
      score -= 1;
    } else if (evidence.effectAssessment?.label === "Weakens") {
      score -= 2;
    }
  } else if (evidence && !evidence.supported) {
    score -= 1;
  }

  let label = "Promising but needs validation";
  let toneClass = "triage-caution";

  if (score >= 4 && evidence?.effectAssessment?.label !== "Weakens") {
    label = "Strong candidate";
    toneClass = "triage-good";
  } else if (score <= 1) {
    label = "Weak / tentative";
    toneClass = "triage-bad";
  }

  return {
    label,
    toneClass,
    rationale: buildTriageRationale(label, lead, planner, evidence),
    prioritySummary: buildPrioritySummary(label, lead, evidence)
  };
}

function buildTriageRationale(label, lead, planner, evidence) {
  if (evidence?.supported && evidence.effectAssessment?.label === "Strengthens") {
    return "Strong observed gap plus useful baseline context. Still a reporting lead, but it looks worth assigning."
  }

  if (evidence?.supported && evidence.effectAssessment?.label === "Weakens") {
    return "Interesting raw gap, but added context makes it look less stable. Treat this as a weaker story idea."
  }

  if (evidence?.supported && evidence.effectAssessment?.label === "Complicates") {
    return "The signal is interesting, but the added context narrows or complicates it. It needs tighter validation before assignment."
  }

  if ((planner.claimLimitations?.length || 0) >= 4) {
    return "Plausible story idea, but it still lacks enough baseline or comparison context to treat as a strong lead."
  }

  if (lead.promiseScore >= 60) {
    return "Clear observed pattern with public-interest potential, but the missing baseline and verification steps still matter."
  }

  return "There is a possible signal here, but the current evidence is still too thin for high-priority follow-up."
}

function buildPrioritySummary(label, lead, evidence) {
  if (label === "Strong candidate") {
    return "Editorially worth pursuing now";
  }

  if (label === "Weak / tentative") {
    return "Hold unless new evidence improves it";
  }

  if (evidence?.supported) {
    return "Interesting, but still needs validation";
  }

  return "Scan-worthy, but not yet ready to trust";
}

function buildAnalysisContext(result) {
  return {
    datasetFilename: result?.dataset?.filename || "Uploaded dataset",
    discoveryTitle: result?.discovery?.title || null,
    discoverySource: result?.discovery?.source || null,
    discoveryFormat: result?.discovery?.format || null
  };
}

function buildHypothesisDossier(lead, evidence, planner, analysisContext) {
  const primaryDatasetLabel = analysisContext?.discoveryTitle
    ? `${analysisContext.discoveryTitle} (${analysisContext.discoverySource || "source dataset"}) provided the initial signal`
    : `${analysisContext?.datasetFilename || "The uploaded dataset"} provided the initial signal`;

  const secondaryDatasets = (evidence?.secondaryDatasets || []).map((item) => {
    const effectLabel = evidence?.effectAssessment?.label
      ? `${evidence.effectAssessment.label.toLowerCase()} or contextual`
      : "contextual";
    return `${item.title} (${item.source}) contributed ${effectLabel} evidence via ${item.joinKey}.`;
  });

  return {
    statement: lead.hypothesis,
    currentEvidenceSummary: summarizeEvidenceBundle(lead, evidence),
    datasetsContributingEvidence: [primaryDatasetLabel, ...secondaryDatasets],
    supportingSummary: summarizeSupportingEvidence(lead, evidence),
    conflictingSummary: summarizeConflictingEvidence(lead, evidence, planner),
    stillNeedsVerification: uniqueList([
      ...(planner.missingFieldsOrComparisons || []).slice(0, 3),
      ...(planner.followUpDataSuggestions || []).slice(0, 2)
    ]),
    cannotYetConclude: uniqueList([
      ...(planner.claimLimitations || []).slice(0, 3),
      ...(evidence?.remainingUncertainty || []).slice(0, 2)
    ])
  };
}

function summarizeEvidenceBundle(lead, evidence) {
  if (evidence?.supported) {
    return `Initial signal from the primary dataset plus ${evidence.secondaryDatasets.length} secondary dataset source. Added context ${evidence.effectAssessment.label.toLowerCase()} the hypothesis.`;
  }

  if (evidence && !evidence.supported) {
    return `The primary dataset shows the initial signal, but no automated secondary comparison was available yet.`;
  }

  return `The primary dataset shows the initial signal, but this hypothesis still rests on one dataset so far.`;
}

function summarizeSupportingEvidence(lead, evidence) {
  if (evidence?.supported && evidence.effectAssessment?.label === "Strengthens") {
    return `${evidence.addedContext.comparisonSummary} This secondary baseline context points in the same direction as the original signal.`;
  }

  return `The main support so far is the original observed pattern: ${lead.patternFound}`;
}

function summarizeConflictingEvidence(lead, evidence, planner) {
  if (evidence?.supported && evidence.effectAssessment?.label === "Weakens") {
    return evidence.effectAssessment.reasoning;
  }

  if (evidence?.supported && evidence.effectAssessment?.label === "Complicates") {
    return evidence.effectAssessment.reasoning;
  }

  return planner.claimLimitations?.[0] || planner.cautionAndValidationNotes?.[0] || lead.possibleWeaknesses;
}

function uniqueList(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function requireElement(root, selector) {
  const element = root.querySelector(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

function buildHypothesisFallbackCard(hypothesis, error) {
  const article = document.createElement("article");
  article.className = "panel lead-card hypothesis-fallback-card";
  article.innerHTML = `
    <h3>${escapeHtml(hypothesis?.headline || "Hypothesis could not render")}</h3>
    <p class="muted">The search flow generated this hypothesis object, but the browser hit a render error for this card.</p>
    <p><strong>Render error:</strong> ${escapeHtml(error instanceof Error ? error.message : "Unknown render error")}</p>
    <p><strong>Hypothesis id:</strong> ${escapeHtml(hypothesis?.id || "Unavailable")}</p>
  `;
  return article;
}

function renderDeveloperPanel() {
  const sections = [];

  if (developerDebugState.explain) {
    sections.push(`
      <section class="developer-section">
        <h3>Explain-page flow</h3>
        <dl class="dataset-details">
          <div>
            <dt>Status</dt>
            <dd>${escapeHtml(developerDebugState.explain.status)}</dd>
          </div>
          <div>
            <dt>Page title</dt>
            <dd>${escapeHtml(developerDebugState.explain.pageTitle || "")}</dd>
          </div>
          <div>
            <dt>Question present</dt>
            <dd>${escapeHtml(String(developerDebugState.explain.questionPresent))}</dd>
          </div>
          <div>
            <dt>Anchor event</dt>
            <dd>${escapeHtml(JSON.stringify(developerDebugState.explain.anchorEvent || null))}</dd>
          </div>
          <div>
            <dt>Initial mechanisms</dt>
            <dd>${escapeHtml(JSON.stringify(developerDebugState.explain.initialMechanisms || []))}</dd>
          </div>
          <div>
            <dt>Final mechanisms</dt>
            <dd>${escapeHtml(JSON.stringify(developerDebugState.explain.finalMechanisms || []))}</dd>
          </div>
          <div>
            <dt>Table count</dt>
            <dd>${escapeHtml(String(developerDebugState.explain.tableCount || 0))}</dd>
          </div>
          <div>
            <dt>Usable table count</dt>
            <dd>${escapeHtml(String(developerDebugState.explain.usableTableCount || 0))}</dd>
          </div>
          <div>
            <dt>Structured signals</dt>
            <dd>${escapeHtml(String(developerDebugState.explain.structuredSignalCount || 0))}</dd>
          </div>
        </dl>
      </section>
    `);
  }

  if (developerDebugState.search) {
    sections.push(`
      <section class="developer-section">
        <h3>Search flow</h3>
        <dl class="dataset-details">
          <div>
            <dt>Search topic</dt>
            <dd>${escapeHtml(developerDebugState.search.query?.topic || "")}</dd>
          </div>
          <div>
            <dt>Discovered datasets</dt>
            <dd>${escapeHtml(String(developerDebugState.search.datasetCount))}</dd>
          </div>
          <div>
            <dt>Generated hypotheses</dt>
            <dd>${escapeHtml(String(developerDebugState.search.hypothesisCount))}</dd>
          </div>
          <div>
            <dt>Primary renderer</dt>
            <dd>${escapeHtml(developerDebugState.search.primaryRenderer)}</dd>
          </div>
        </dl>
      </section>
    `);
  }

  if (developerDebugState.hypothesis) {
    sections.push(`
      <section class="developer-section">
        <h3>Hypothesis rendering</h3>
        <dl class="dataset-details">
          <div>
            <dt>Hypothesis objects received</dt>
            <dd>${escapeHtml(String(developerDebugState.hypothesis.hypothesisCount))}</dd>
          </div>
          <div>
            <dt>Render attempts</dt>
            <dd>${renderBulletList(developerDebugState.hypothesis.renderAttempts || [])}</dd>
          </div>
        </dl>
        <pre class="debug-json">${escapeHtml(
          JSON.stringify(developerDebugState.hypothesis.firstHypothesis || null, null, 2)
        )}</pre>
      </section>
    `);
  }

  if (developerDebugState.upload) {
    sections.push(`
      <section class="developer-section">
        <h3>Upload analysis</h3>
        <dl class="dataset-details">
          <div>
            <dt>Endpoint</dt>
            <dd>${escapeHtml(developerDebugState.upload.endpoint)}</dd>
          </div>
          <div>
            <dt>Filename</dt>
            <dd>${escapeHtml(developerDebugState.upload.filename)}</dd>
          </div>
          <div>
            <dt>Request body fields</dt>
            <dd>${escapeHtml(JSON.stringify(developerDebugState.upload.requestBodyFields))}</dd>
          </div>
          <div>
            <dt>CSV text length</dt>
            <dd>${escapeHtml(String(developerDebugState.upload.csvTextLength))}</dd>
          </div>
          <div>
            <dt>First two CSV lines</dt>
            <dd>${escapeHtml(JSON.stringify(developerDebugState.upload.csvFirstTwoLines))}</dd>
          </div>
          <div>
            <dt>Parsed column names</dt>
            <dd>${escapeHtml(JSON.stringify(developerDebugState.upload.parsedColumnNames))}</dd>
          </div>
          <div>
            <dt>Detected groupColumns</dt>
            <dd>${escapeHtml(JSON.stringify(developerDebugState.upload.detectedGroupColumns))}</dd>
          </div>
          <div>
            <dt>Detected metricColumns</dt>
            <dd>${escapeHtml(JSON.stringify(developerDebugState.upload.detectedMetricColumns))}</dd>
          </div>
          <div>
            <dt>Schema inference succeeded</dt>
            <dd>${escapeHtml(String(developerDebugState.upload.schemaInferenceSucceeded))}</dd>
          </div>
          <div>
            <dt>Disparity analysis ran</dt>
            <dd>${escapeHtml(String(developerDebugState.upload.disparityAnalysisRan))}</dd>
          </div>
          <div>
            <dt>Disparity analysis succeeded</dt>
            <dd>${escapeHtml(String(developerDebugState.upload.disparityAnalysisSucceeded))}</dd>
          </div>
          <div>
            <dt>Error or rejection reason</dt>
            <dd>${escapeHtml(developerDebugState.upload.error)}</dd>
          </div>
        </dl>
        <pre class="debug-json">${escapeHtml(JSON.stringify(developerDebugState.upload.rawPayload, null, 2))}</pre>
      </section>
    `);
  }

  if (!sections.length) {
    developerPanelEl.classList.add("hidden");
    developerDebugEl.innerHTML = "";
    return;
  }

  developerPanelEl.classList.remove("hidden");
  developerDebugEl.innerHTML = sections.join("");
}

function capitalize(value) {
  const text = String(value || "");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}
