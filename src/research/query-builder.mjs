export function buildResearchQuery({ question = {}, page = {}, maxTerms = 6 } = {}) {
  const preferredTerms = [
    ...question.concepts,
    ...question.entities.map((entity) => entity.toLowerCase())
  ].filter(Boolean);

  const dedupedTerms = [...new Set(preferredTerms)].slice(0, maxTerms);
  const searchQuery = dedupedTerms.length
    ? dedupedTerms.join(" ")
    : String(question.normalized || page.title || "").trim();

  return {
    searchQuery,
    concepts: dedupedTerms,
    sourcesQueried: ["OpenAlex"]
  };
}
