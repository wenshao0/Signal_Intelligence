import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { analyzeCsvText, parseAnalysisDataset } from "./src/analysis/disparity-analyzer.mjs";
import { discoverDatasets } from "./src/datasets/discovery.mjs";
import { fetchDatasetForAnalysis } from "./src/datasets/ingestion.mjs";
import { enrichDatasetsWithReview } from "./src/datasets/review.mjs";
import { buildLeadValidationGuidance } from "./src/reporting/validation-planner.mjs";
import { executeLeadEvidence } from "./src/reporting/evidence-executor.mjs";
import { buildDiscoveryHypotheses } from "./src/reporting/discovery-hypotheses.mjs";
import { extractAnchorEvent } from "./src/questions/anchor-extractor.mjs";
import { detectTensions } from "./src/questions/tension-detector.mjs";
import { routeMechanisms } from "./src/questions/mechanism-router.mjs";
import { extractStructuredSignals } from "./src/evidence/structured-signal-extractor.mjs";
import { assembleExplanationCase } from "./src/reporting/explanation-assembler.mjs";

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const PUBLIC_DIR = join(process.cwd(), "public");
const SAMPLE_PATH = join(process.cwd(), "data", "sample-company-peer-metrics.csv");
const MAX_BODY_SIZE = 2 * 1024 * 1024;
const BUSINESS_CONTEXT_PATTERNS =
  /(company|shares?|stock|earnings|revenue|margin|cash|debt|guidance|forecast|analyst|sector|industry|peer|partner|partnership|product|market|valuation|multiple|strategy|customer|pricing|demand)/i;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8"
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/health") {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "GET" && url.pathname === "/sample-data") {
    try {
      const csv = await readFile(SAMPLE_PATH, "utf8");
      res.writeHead(200, { "Content-Type": MIME_TYPES[".csv"] });
      res.end(csv);
    } catch (error) {
      sendJson(res, 500, { error: "Failed to load sample dataset." });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/analyze") {
    const uploadDebug = {
      endpoint: "POST /api/analyze",
      requestBodyFields: [],
      uploadedFilename: null,
      csvTextLength: 0,
      csvFirstTwoLines: [],
      parsedColumnNames: [],
      schemaInferenceSucceeded: false,
      detectedGroupColumns: [],
      detectedMetricColumns: [],
      inferredSchema: null,
      disparityAnalysisRan: false,
      disparityAnalysisSucceeded: false,
      analysisInput: null,
      error: null
    };

    try {
      const body = await readJsonBody(req);
      uploadDebug.requestBodyFields = Object.keys(body || {});
      const csvText = typeof body.csvText === "string" ? body.csvText : "";
      const filename = typeof body.filename === "string" ? body.filename : "uploaded.csv";
      uploadDebug.uploadedFilename = filename;
      uploadDebug.csvTextLength = csvText.length;
      uploadDebug.csvFirstTwoLines = csvText.split(/\r?\n/).slice(0, 2);

      if (!csvText.trim()) {
        uploadDebug.error = "A CSV file is required.";
        return sendJson(res, 400, {
          error: uploadDebug.error,
          uploadDebug
        });
      }

      const parsed = parseAnalysisDataset(csvText, filename);
      uploadDebug.parsedColumnNames = parsed.headers;
      uploadDebug.schemaInferenceSucceeded = true;
      uploadDebug.detectedGroupColumns = parsed.detectedColumns.groupColumns;
      uploadDebug.detectedMetricColumns = parsed.detectedColumns.metricColumns;
      uploadDebug.inferredSchema = {
        dataset: parsed.dataset,
        detectedColumns: parsed.detectedColumns
      };
      uploadDebug.analysisInput = {
        filename,
        rowCount: parsed.dataset.rowCount,
        columnCount: parsed.dataset.columnCount,
        parsedColumnNames: parsed.headers
      };
      uploadDebug.disparityAnalysisRan = true;

      const analysis = addLeadValidationGuidance(analyzeCsvText(csvText, filename));
      uploadDebug.disparityAnalysisSucceeded = true;
      analysis.uploadDebug = uploadDebug;
      return sendJson(res, 200, analysis);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      const status = message.startsWith("Payload too large") ? 413 : 400;
      uploadDebug.error = message;
      return sendJson(res, status, {
        error: message,
        uploadDebug
      });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/discover") {
    try {
      const body = await readJsonBody(req);
      const topic = typeof body.topic === "string" ? body.topic : "";
      const location = typeof body.location === "string" ? body.location : "";
      const result = await discoverDatasets({ topic, location });
      result.candidates = await enrichDatasetsWithReview(result.candidates);
      result.hypotheses = await buildDiscoveryHypotheses(result.candidates);
      return sendJson(res, 200, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected discovery error.";
      return sendJson(res, 400, { error: message });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/explain-page") {
    try {
      const body = await readJsonBody(req);
      const page = normalizePageContext(body.page || {});
      const userQuestion = typeof body.userQuestion === "string" ? body.userQuestion : "";
      const maxExplanations = normalizeMaxExplanations(body.options?.maxExplanations);
      const anchor = extractAnchorEvent({ page, userQuestion });

      if (anchor.status === "needs_question") {
        return sendJson(res, 200, {
          status: "needs_question",
          message: "Enter a concrete business question or event before asking for an explanation.",
          debug: buildExplainDebug({ page, anchor, initialMechanisms: [], structuredEvidence: null, mechanisms: [] })
        });
      }

      const initialMechanisms = routeMechanisms({
        page,
        anchorEvent: anchor.anchorEvent,
        coreQuestion: anchor.coreQuestion,
        tensions: [],
        structuredSignals: [],
        maxMechanisms: maxExplanations
      });
      const structuredEvidence = extractStructuredSignals({
        tables: page.tables || [],
        mechanisms: initialMechanisms
      });
      const tensions = detectTensions({
        page,
        anchorEvent: anchor.anchorEvent,
        structuredSignals: structuredEvidence.signals
      });
      const mechanisms = routeMechanisms({
        page,
        anchorEvent: anchor.anchorEvent,
        coreQuestion: anchor.coreQuestion,
        tensions,
        structuredSignals: structuredEvidence.signals,
        maxMechanisms: maxExplanations
      });
      const debug = buildExplainDebug({
        page,
        anchor,
        initialMechanisms,
        structuredEvidence,
        mechanisms
      });

      if (!hasBusinessContext(page, structuredEvidence, anchor.coreQuestion)) {
        return sendJson(res, 200, {
          status: "unsupported_input",
          message:
            "This version works best when the page or question has a clear business event and optional business-style supporting tables.",
          debug
        });
      }

      const explanationCase = assembleExplanationCase({
        page,
        anchor,
        tensions,
        mechanisms,
        structuredEvidence
      });

      if (!explanationCase.explanations.length) {
        return sendJson(res, 200, {
          status: "insufficient_context",
          message:
            "This page does not yet provide enough signal for a strong explanation. A clearer question, a sharper event anchor, or a business-style supporting table would help.",
          case: explanationCase,
          debug
        });
      }

      return sendJson(res, 200, {
        status: "ok",
        case: explanationCase,
        debug
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected explanation error.";
      return sendJson(res, 400, { status: "error", error: message });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/analyze-discovered") {
    try {
      const body = await readJsonBody(req);
      const candidate = body.candidate;
      const dataset = await fetchDatasetForAnalysis(candidate);
      const analysis = addLeadValidationGuidance(
        analyzeCsvText(dataset.csvText, dataset.filename),
        dataset.discovery?.review || null
      );
      analysis.discovery = dataset.discovery;
      return sendJson(res, 200, analysis);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected dataset analysis error.";
      return sendJson(res, 400, { error: message });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/lead-evidence") {
    try {
      const body = await readJsonBody(req);
      const leadRef = body.leadRef || {};
      const source = body.source || {};
      const prepared = await prepareAnalysisSource(source);
      const analysis = addLeadValidationGuidance(
        analyzeCsvText(prepared.csvText, prepared.filename),
        prepared.discoveryReview
      );
      const lead = analysis.leads.find(
        (item) =>
          item.comparison.groupColumn === leadRef.groupColumn &&
          item.comparison.metricColumn === leadRef.metricColumn
      );

      if (!lead) {
        return sendJson(res, 404, { error: "The selected lead could not be rebuilt from the current dataset." });
      }

      const evidence = await executeLeadEvidence({
        csvText: prepared.csvText,
        filename: prepared.filename,
        lead,
        analysis
      });

      return sendJson(res, 200, {
        leadRef,
        evidence
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected lead evidence error.";
      return sendJson(res, 400, { error: message });
    }
  }

  if (req.method === "GET") {
    const assetPath = url.pathname === "/" ? "/index.html" : url.pathname;
    return serveStaticFile(assetPath, res);
  }

  sendJson(res, 404, { error: "Not found." });
});

server.listen(PORT, HOST, () => {
  console.log(`Signal Desk running on http://${HOST}:${PORT}`);
});

async function serveStaticFile(assetPath, res) {
  const fullPath = join(PUBLIC_DIR, assetPath);

  try {
    const file = await readFile(fullPath);
    const ext = extname(fullPath);
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    res.end(file);
  } catch (error) {
    sendJson(res, 404, { error: "Asset not found." });
  }
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_SIZE) {
      throw new Error("Payload too large. Limit uploads to 2 MB.");
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error("Request body must be valid JSON.");
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": MIME_TYPES[".json"] });
  res.end(JSON.stringify(payload, null, 2));
}

function addLeadValidationGuidance(analysis, discoveryReview = null) {
  return {
    ...analysis,
    leads: analysis.leads.map((lead) => ({
      ...lead,
      validationPlanner: buildLeadValidationGuidance({
        lead,
        analysis,
        discoveryReview
      })
    }))
  };
}

async function prepareAnalysisSource(source) {
  if (source?.mode === "upload") {
    const csvText = typeof source.csvText === "string" ? source.csvText : "";
    const filename = typeof source.filename === "string" ? source.filename : "uploaded.csv";

    if (!csvText.trim()) {
      throw new Error("A CSV source is required to run lead evidence checks.");
    }

    return {
      csvText,
      filename,
      discoveryReview: null
    };
  }

  if (source?.mode === "discovered") {
    const candidate = source.candidate;
    const dataset = await fetchDatasetForAnalysis(candidate);

    return {
      csvText: dataset.csvText,
      filename: dataset.filename,
      discoveryReview: dataset.discovery?.review || null
    };
  }

  throw new Error("Unsupported analysis source for lead evidence checks.");
}

function normalizePageContext(page) {
  return {
    url: typeof page.url === "string" ? page.url : "",
    title: typeof page.title === "string" ? page.title.trim() : "",
    selectedText: typeof page.selectedText === "string" ? page.selectedText.trim() : "",
    articleText: typeof page.articleText === "string" ? page.articleText.trim() : "",
    tables: Array.isArray(page.tables) ? page.tables : []
  };
}

function normalizeMaxExplanations(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 2;
  }
  return Math.max(1, Math.min(2, Math.round(parsed)));
}

function hasBusinessContext(page, structuredEvidence, coreQuestion = "") {
  const text = [page.title, page.selectedText, page.articleText, coreQuestion].join(" ");
  return BUSINESS_CONTEXT_PATTERNS.test(text) || structuredEvidence.tablesReviewed.some((table) => table.usable);
}

function buildExplainDebug({ page, anchor, initialMechanisms, structuredEvidence, mechanisms }) {
  return {
    pageTitle: page.title || "",
    questionPresent: Boolean(anchor?.coreQuestion),
    anchorEvent: anchor?.anchorEvent || null,
    initialMechanisms: (initialMechanisms || []).map((item) => item.family),
    finalMechanisms: (mechanisms || []).map((item) => item.family),
    tableCount: page.tables?.length || 0,
    usableTableCount: structuredEvidence?.tablesReviewed?.filter((table) => table.usable).length || 0,
    structuredSignalCount: structuredEvidence?.signals?.length || 0
  };
}
