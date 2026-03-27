const FETCH_TIMEOUT_MS = 12000;
const MAX_DOWNLOAD_BYTES = 2 * 1024 * 1024;
const MAX_RECORDS = 1000;
const PREVIEW_RECORDS = 250;
const PREVIEW_DOWNLOAD_BYTES = 1024 * 1024;

export async function fetchDatasetForAnalysis(candidate) {
  if (!candidate?.suitability?.selectable || !candidate?.access) {
    throw new Error(candidate?.suitability?.reason || "This dataset is not suitable for analysis in the current prototype.");
  }

  if (candidate.access.type === "remote-file") {
    return fetchRemoteFile(candidate);
  }

  if (candidate.access.type === "socrata-json") {
    return fetchSocrataDataset(candidate);
  }

  throw new Error("Unsupported dataset access method.");
}

export async function previewDataset(candidate) {
  if (!candidate?.suitability?.selectable || !candidate?.access) {
    return {
      sampled: false,
      limitations: [candidate?.suitability?.reason || "Dataset is not selectable in the current prototype."]
    };
  }

  try {
    if (candidate.access.type === "remote-file") {
      return await previewRemoteFile(candidate);
    }

    if (candidate.access.type === "socrata-json") {
      return await previewSocrataDataset(candidate);
    }

    return {
      sampled: false,
      limitations: ["Unsupported dataset access method."]
    };
  } catch (error) {
    return {
      sampled: false,
      limitations: [error instanceof Error ? error.message : "Preview sampling failed."]
    };
  }
}

async function fetchRemoteFile(candidate) {
  const format = String(candidate.access.format || "").toUpperCase();

  if (format === "CSV") {
    return {
      csvText: await fetchTextWithLimit(candidate.access.url, MAX_DOWNLOAD_BYTES),
      filename: buildFilename(candidate, "csv"),
      discovery: buildDiscoveryMetadata(candidate, "CSV")
    };
  }

  if (format === "JSON") {
    return {
      csvText: normalizeJsonToCsv(await fetchJsonWithLimit(candidate.access.url, MAX_DOWNLOAD_BYTES)),
      filename: buildFilename(candidate, "json.csv"),
      discovery: buildDiscoveryMetadata(candidate, "JSON normalized to CSV")
    };
  }

  throw new Error("Only CSV and JSON downloads are supported.");
}

async function fetchSocrataDataset(candidate) {
  const url = new URL(`https://${candidate.access.domain}/resource/${candidate.access.datasetId}.json`);
  url.searchParams.set("$limit", String(MAX_RECORDS));

  const payload = await fetchJsonWithLimit(url.toString(), MAX_DOWNLOAD_BYTES);
  const csvText = normalizeJsonToCsv(payload);

  return {
    csvText,
    filename: buildFilename(candidate, "json.csv"),
    discovery: {
      ...buildDiscoveryMetadata(candidate, "JSON via Socrata API normalized to CSV"),
      normalizationNote: `Fetched up to ${MAX_RECORDS} rows through the portal API for a first-pass screen.`
    }
  };
}

function buildDiscoveryMetadata(candidate, fetchedFormat) {
  return {
    title: candidate.title,
    source: candidate.source,
    format: fetchedFormat,
    metadataUrl: candidate.metadataUrl || null,
    whyAnalyzable: candidate.whyAnalyzable || null,
    review: candidate.review || null
  };
}

function buildFilename(candidate, suffix) {
  return `${slugify(candidate.title || "dataset")}.${suffix}`;
}

function normalizeJsonToCsv(payload, maxRecords = MAX_RECORDS) {
  const records = extractRecordArray(payload).slice(0, maxRecords);
  if (!records.length) {
    throw new Error("The selected JSON dataset did not contain any tabular records.");
  }

  const flattened = records.map((record) => flattenRecord(record)).filter(hasValues);
  if (!flattened.length) {
    throw new Error("The selected dataset could not be flattened into usable rows.");
  }

  return recordsToCsv(flattened);
}

function extractRecordArray(payload) {
  if (Array.isArray(payload)) {
    return payload.filter(isPlainObject);
  }

  if (Array.isArray(payload?.data)) {
    return payload.data.filter(isPlainObject);
  }

  if (Array.isArray(payload?.results)) {
    return payload.results.filter(isPlainObject);
  }

  if (Array.isArray(payload?.result?.records)) {
    return payload.result.records.filter(isPlainObject);
  }

  throw new Error("The selected JSON payload is not an array of records that can be analyzed.");
}

function flattenRecord(record, prefix = "", depth = 0, target = {}) {
  for (const [key, value] of Object.entries(record)) {
    if (key.startsWith(":")) {
      continue;
    }

    const nextKey = prefix ? `${prefix}_${key}` : key;

    if (value === null || value === undefined) {
      target[nextKey] = "";
      continue;
    }

    if (Array.isArray(value)) {
      target[nextKey] = value.every(isPrimitive) ? value.join(" | ") : JSON.stringify(value);
      continue;
    }

    if (isPlainObject(value) && depth < 1) {
      flattenRecord(value, nextKey, depth + 1, target);
      continue;
    }

    target[nextKey] = isPrimitive(value) ? String(value) : JSON.stringify(value);
  }

  return target;
}

function recordsToCsv(records) {
  const headers = [...new Set(records.flatMap((record) => Object.keys(record)))];
  const lines = [headers.map(escapeCsvCell).join(",")];

  for (const record of records) {
    const row = headers.map((header) => escapeCsvCell(record[header] ?? ""));
    lines.push(row.join(","));
  }

  return lines.join("\n");
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) {
    return text;
  }
  return `"${text.replaceAll("\"", "\"\"")}"`;
}

function hasValues(record) {
  return Object.values(record).some((value) => String(value).trim() !== "");
}

function isPrimitive(value) {
  return ["string", "number", "boolean"].includes(typeof value);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function slugify(value) {
  return String(value || "dataset")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function previewRemoteFile(candidate) {
  const format = String(candidate.access.format || "").toUpperCase();

  if (format === "CSV") {
    return {
      sampled: true,
      csvText: await fetchTextWithLimit(candidate.access.url, PREVIEW_DOWNLOAD_BYTES)
    };
  }

  if (format === "JSON") {
    return {
      sampled: true,
      csvText: normalizeJsonToCsv(await fetchJsonWithLimit(candidate.access.url, PREVIEW_DOWNLOAD_BYTES), PREVIEW_RECORDS)
    };
  }

  return {
    sampled: false,
    limitations: ["Only CSV and JSON downloads are supported."]
  };
}

async function previewSocrataDataset(candidate) {
  const rowCountUrl = new URL(`https://${candidate.access.domain}/resource/${candidate.access.datasetId}.json`);
  rowCountUrl.searchParams.set("$select", "count(*) as row_count");

  const sampleUrl = new URL(`https://${candidate.access.domain}/resource/${candidate.access.datasetId}.json`);
  sampleUrl.searchParams.set("$limit", String(PREVIEW_RECORDS));

  const [countPayload, samplePayload] = await Promise.all([
    fetchJsonWithLimit(rowCountUrl.toString(), PREVIEW_DOWNLOAD_BYTES),
    fetchJsonWithLimit(sampleUrl.toString(), PREVIEW_DOWNLOAD_BYTES)
  ]);

  const countValue = Array.isArray(countPayload) ? Number(countPayload[0]?.row_count) : Number.NaN;

  return {
    sampled: true,
    rowCount: Number.isFinite(countValue) ? countValue : null,
    csvText: normalizeJsonToCsv(samplePayload, PREVIEW_RECORDS)
  };
}

async function fetchTextWithLimit(url, maxBytes = MAX_DOWNLOAD_BYTES) {
  const buffer = await fetchBufferWithLimit(url, maxBytes);
  return Buffer.from(buffer).toString("utf8");
}

async function fetchJsonWithLimit(url, maxBytes = MAX_DOWNLOAD_BYTES) {
  const text = await fetchTextWithLimit(url, maxBytes);
  return JSON.parse(text);
}

async function fetchBufferWithLimit(url, maxBytes = MAX_DOWNLOAD_BYTES) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Dataset download failed (${response.status}).`);
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > maxBytes) {
      throw new Error("Dataset is too large for the current prototype. Try a smaller extract or direct CSV upload.");
    }

    return buffer;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Dataset download timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
