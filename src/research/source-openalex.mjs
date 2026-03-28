const OPENALEX_BASE_URL = "https://api.openalex.org/works";
const REQUEST_TIMEOUT_MS = 8000;

export async function searchOpenAlexWorks({ searchQuery, perPage = 8 }) {
  if (!String(searchQuery || "").trim()) {
    return [];
  }

  const url = new URL(OPENALEX_BASE_URL);
  url.searchParams.set("search", searchQuery);
  url.searchParams.set("per-page", String(Math.max(1, Math.min(perPage, 10))));

  if (process.env.OPENALEX_MAILTO) {
    url.searchParams.set("mailto", process.env.OPENALEX_MAILTO);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`OpenAlex request failed with status ${response.status}.`);
    }

    const payload = await response.json();
    return Array.isArray(payload.results) ? payload.results : [];
  } finally {
    clearTimeout(timeout);
  }
}
