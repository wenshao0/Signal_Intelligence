const DATA_GOV_SEARCH_URL = "https://catalog.data.gov/api/3/action/package_search";
const SOCRATA_CATALOG_URL = "https://api.us.socrata.com/api/catalog/v1";
const MAX_RESULTS_PER_SOURCE = 4;
const DISCOVERY_TIMEOUT_MS = 8000;

const SOCRATA_SOURCES = [
  {
    id: "nyc-open-data",
    name: "NYC Open Data",
    domain: "data.cityofnewyork.us",
    locationKeywords: ["new york", "nyc", "brooklyn", "bronx", "queens", "manhattan", "staten island"]
  },
  {
    id: "chicago-data-portal",
    name: "Chicago Data Portal",
    domain: "data.cityofchicago.org",
    locationKeywords: ["chicago", "illinois", "il"]
  }
];

export async function discoverDatasets({ topic, location = "" }) {
  const trimmedTopic = String(topic || "").trim();
  const trimmedLocation = String(location || "").trim();

  if (!trimmedTopic) {
    throw new Error("A topic is required to search public datasets.");
  }

  const searchText = [trimmedTopic, trimmedLocation].filter(Boolean).join(" ");
  const providers = [
    searchDataGov(searchText, trimmedLocation),
    ...SOCRATA_SOURCES.map((source) => searchSocrataCatalog(source, searchText, trimmedLocation))
  ];

  const settled = await Promise.allSettled(providers);
  const datasets = [];
  const errors = [];

  for (const result of settled) {
    if (result.status === "fulfilled") {
      datasets.push(...result.value.datasets);
      errors.push(...result.value.errors);
    } else {
      errors.push(result.reason instanceof Error ? result.reason.message : "Unknown discovery error.");
    }
  }

  const shortlisted = datasets
    .sort((left, right) => right.score - left.score)
    .slice(0, 6)
    .map(stripScore);

  return {
    query: {
      topic: trimmedTopic,
      location: trimmedLocation
    },
    supportedSources: ["data.gov", ...SOCRATA_SOURCES.map((source) => source.name)],
    candidates: shortlisted,
    warnings: errors.slice(0, 3)
  };
}

async function searchDataGov(searchText, location) {
  const url = new URL(DATA_GOV_SEARCH_URL);
  url.searchParams.set("q", searchText);
  url.searchParams.set("rows", String(MAX_RESULTS_PER_SOURCE));

  const payload = await fetchJson(url.toString());
  const results = Array.isArray(payload?.result?.results) ? payload.result.results : [];

  return {
    datasets: results.map((item) => mapDataGovDataset(item, searchText, location)).filter(Boolean),
    errors: []
  };
}

async function searchSocrataCatalog(source, searchText, location) {
  const url = new URL(SOCRATA_CATALOG_URL);
  url.searchParams.set("search_context", source.domain);
  url.searchParams.set("q", searchText);
  url.searchParams.set("limit", String(MAX_RESULTS_PER_SOURCE));
  url.searchParams.set("only", "datasets");

  const payload = await fetchJson(url.toString());
  const results = Array.isArray(payload?.results) ? payload.results : [];

  return {
    datasets: results.map((item) => mapSocrataDataset(item, source, searchText, location)).filter(Boolean),
    errors: []
  };
}

function mapDataGovDataset(item, searchText, location) {
  const resources = Array.isArray(item.resources) ? item.resources : [];
  const supportedResource = pickSupportedDataGovResource(resources);
  const description = shortenText(item.notes || item.title || "No description provided.");
  const baseScore = scoreCandidate({
    title: item.title,
    description,
    searchText,
    location,
    sourceName: "data.gov"
  });

  if (!supportedResource) {
    return {
      id: `data-gov:${item.id}`,
      title: item.title || "Untitled dataset",
      source: "data.gov",
      publisher: item.organization?.title || item.author || item.maintainer || "Unknown",
      freshness: {
        raw: item.metadata_modified || item.revision_timestamp || null
      },
      description,
      format: "No direct CSV/JSON resource found",
      whyAnalyzable:
        "This catalog entry does not expose a clear CSV or JSON download URL, so the prototype cannot normalize it reliably.",
      suitability: {
        selectable: false,
        reason: "No supported CSV or JSON resource was found in the data.gov metadata."
      },
      access: null,
      metadataUrl: item.url || null,
      score: baseScore - 15
    };
  }

  return {
    id: `data-gov:${item.id}`,
    title: item.title || "Untitled dataset",
    source: "data.gov",
    publisher: item.organization?.title || item.author || item.maintainer || "Unknown",
    freshness: {
      raw: item.metadata_modified || item.revision_timestamp || null
    },
    description,
    format: supportedResource.format,
    whyAnalyzable:
      "A structured CSV or JSON resource is available directly from the catalog, so it can be normalized into rows and screened for group disparities.",
    suitability: {
      selectable: true,
      reason: "Structured download available."
    },
    access: {
      type: "remote-file",
      url: supportedResource.url,
      format: supportedResource.format
    },
    metadataUrl: item.url || supportedResource.url || null,
    score: baseScore + formatScore(supportedResource.format)
  };
}

function mapSocrataDataset(item, source, searchText, location) {
  const resource = item.resource || {};
  const type = String(resource.type || "").toLowerCase();
  const columns = Array.isArray(resource.columns_datatype) ? resource.columns_datatype : [];
  const hasNumber = columns.some((value) => /number|money|percent/i.test(value));
  const hasText = columns.some((value) => /text|checkbox/i.test(value));
  const unsuitableType = /map|chart|file|document|image/.test(type);
  const selectable = Boolean(resource.id) && !unsuitableType;
  const description = shortenText(resource.description || resource.name || "No description provided.");
  const format = "JSON via Socrata API";
  const reason = selectable
    ? hasNumber && hasText
      ? "Catalog metadata suggests both numeric and categorical columns, which is promising for disparity detection."
      : "The dataset is available as structured JSON rows through the portal API and can be normalized for screening."
    : "This search result does not look like a tabular dataset that can be converted into rows for analysis.";

  return {
    id: `${source.id}:${resource.id}`,
    title: resource.name || "Untitled dataset",
    source: source.name,
    publisher: resource.attribution || source.name,
    freshness: {
      raw: resource.updatedAt || resource.metadata_updated_at || null
    },
    description,
    format,
    whyAnalyzable: reason,
    suitability: {
      selectable,
      reason: selectable ? "Structured dataset available." : "Result is not a tabular API dataset."
    },
    access: selectable
      ? {
          type: "socrata-json",
          domain: source.domain,
          datasetId: resource.id,
          format: "json"
        }
      : null,
    metadataUrl: item.permalink || `https://${source.domain}/d/${resource.id}`,
    score: scoreCandidate({
      title: resource.name,
      description,
      searchText,
      location,
      sourceName: source.name
    }) + (hasNumber ? 8 : 0) + (hasText ? 8 : 0)
  };
}

function pickSupportedDataGovResource(resources) {
  const supported = resources
    .map((resource) => {
      const format = normalizeFormat(resource.format || resource.mimetype || "");
      const resourceUrl = resource.download_url || resource.url;

      if (!resourceUrl || !format) {
        return null;
      }

      if (!looksLikeDirectDataUrl(resourceUrl, format)) {
        return null;
      }

      return {
        format,
        url: resourceUrl
      };
    })
    .filter(Boolean);

  return supported[0] || null;
}

function normalizeFormat(format) {
  const normalized = String(format || "").toLowerCase();
  if (normalized.includes("csv")) {
    return "CSV";
  }
  if (normalized.includes("json")) {
    return "JSON";
  }
  return null;
}

function looksLikeDirectDataUrl(url, format) {
  if (format === "CSV") {
    return /\.csv(\?|$)/i.test(url) || /format=csv/i.test(url);
  }
  if (format === "JSON") {
    return /\.json(\?|$)/i.test(url) || /format=json/i.test(url) || /api\//i.test(url);
  }
  return false;
}

function scoreCandidate({ title, description, searchText, location, sourceName }) {
  const haystack = `${title || ""} ${description || ""} ${sourceName || ""}`.toLowerCase();
  const tokens = searchText
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);

  let score = 20;
  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += 10;
    }
  }

  if (location && haystack.includes(location.toLowerCase())) {
    score += 10;
  }

  return score;
}

function formatScore(format) {
  return format === "CSV" ? 8 : 6;
}

function shortenText(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= 220) {
    return text;
  }
  return `${text.slice(0, 217)}...`;
}

function stripScore(candidate) {
  const { score, ...rest } = candidate;
  return rest;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Catalog request failed (${response.status}).`);
    }

    return await response.json();
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Dataset catalog request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
