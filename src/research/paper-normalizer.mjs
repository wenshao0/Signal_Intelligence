export function normalizeOpenAlexWorks({
  works = [],
  question = {},
  context = {}
} = {}) {
  const normalized = works.map((work) => normalizeWork(work, question, context)).filter(Boolean);
  const seen = new Set();

  return normalized.filter((item) => {
    const key = item.id || item.link || item.title;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function normalizeWork(work, question, context) {
  const title = work.display_name || work.title;
  if (!title) {
    return null;
  }

  const abstractText = invertAbstractIndex(work.abstract_inverted_index);
  const studyType = classifyStudyType(title, abstractText, work.type);
  const population = inferPopulation(abstractText);
  const institutions = extractInstitutions(work.authorships || []);
  const citationCount = Number(work.cited_by_count || 0);
  const relevance = scoreRelevance(question, context, title, abstractText);
  const evidenceStrength = scoreEvidenceStrength(studyType, population, work.publication_year, citationCount);
  const sourceCredibility = scoreSourceCredibility(work, institutions, citationCount);
  const influence = scoreInfluence(citationCount, work.publication_year);
  const accessibility = scoreAccessibility(work, abstractText);
  const pageConnection = scorePageConnection(question, context, title, abstractText);
  const overall = computeOverallScore({
    relevance,
    evidenceStrength,
    sourceCredibility,
    influence,
    accessibility,
    pageConnection
  });

  return {
    id: work.id || work.doi || title,
    sourceType: "paper",
    title,
    source: "OpenAlex",
    link: work.doi ? `https://doi.org/${stripDoiPrefix(work.doi)}` : work.id || "",
    year: work.publication_year || null,
    authors: extractAuthors(work.authorships || []),
    institutions,
    journal: work.primary_location?.source?.display_name || work.host_venue?.display_name || "Unknown source",
    relevance: {
      whyRelevant: buildWhyRelevant(question, title, abstractText),
      score: relevance
    },
    credibility: {
      score: sourceCredibility,
      signals: buildCredibilitySignals(work, institutions, citationCount)
    },
    strength: {
      score: evidenceStrength,
      studyType,
      population,
      limitations: buildLimitations(studyType, population, abstractText)
    },
    influence: {
      citationCount,
      influentialCitationCount: null,
      mediaAttention: ["Science-media attention is not connected in this first slice."]
    },
    extractedClaims: buildExtractedClaims(abstractText),
    whyRelevant: buildWhyRelevant(question, title, abstractText),
    summary: buildSummary(abstractText, title),
    confidenceNotes: buildConfidenceNotes(studyType, population, citationCount),
    scores: {
      overall,
      relevance,
      evidenceStrength,
      sourceCredibility,
      influence,
      attention: 0,
      accessibility,
      pageConnection
    }
  };
}

function computeOverallScore(scores) {
  return Math.round(
    scores.relevance * 0.35 +
      scores.evidenceStrength * 0.25 +
      scores.sourceCredibility * 0.15 +
      scores.influence * 0.1 +
      scores.accessibility * 0.1 +
      scores.pageConnection * 0.05
  );
}

function scoreRelevance(question, context, title, abstractText) {
  const haystack = `${title} ${abstractText}`.toLowerCase();
  let score = 25;

  for (const concept of question.concepts || []) {
    if (haystack.includes(String(concept).toLowerCase())) {
      score += 12;
    }
  }

  for (const entity of question.entities || []) {
    if (haystack.includes(String(entity).toLowerCase())) {
      score += 6;
    }
  }

  if (question.domain === "psychology_neuroscience") {
    score += 8;
  }

  if (haystack.includes("social rejection")) {
    score += 12;
  }

  if (haystack.includes("physical pain") || haystack.includes("social pain")) {
    score += 10;
  }

  if (context.anchor && haystack.includes(context.anchor.toLowerCase().split(" ").slice(0, 3).join(" "))) {
    score += 10;
  }

  return clampScore(score);
}

function scoreEvidenceStrength(studyType, population, year, citationCount) {
  let score = 35;

  if (studyType === "meta_analysis" || studyType === "systematic_review") {
    score += 40;
  } else if (studyType === "review") {
    score += 28;
  } else if (studyType === "randomized_trial" || studyType === "experiment") {
    score += 24;
  } else if (studyType === "cohort_or_observational") {
    score += 18;
  } else if (studyType === "animal_or_preclinical") {
    score += 8;
  }

  if (population && /humans|adults|children|adolescents|participants|patients/i.test(population)) {
    score += 8;
  }

  if (citationCount >= 100) {
    score += 5;
  }

  if (year && year >= new Date().getFullYear() - 5) {
    score += 4;
  }

  return clampScore(score);
}

function scoreSourceCredibility(work, institutions, citationCount) {
  let score = 35;

  if (work.doi) {
    score += 10;
  }

  if (work.primary_location?.source?.display_name) {
    score += 15;
  }

  if (institutions.length) {
    score += 10;
  }

  if (citationCount >= 50) {
    score += 5;
  }

  return clampScore(score);
}

function scoreInfluence(citationCount, year) {
  let score = Math.min(60, Math.log10(Math.max(citationCount, 1)) * 20);

  if (year && year >= new Date().getFullYear() - 3 && citationCount >= 20) {
    score += 10;
  }

  return clampScore(score);
}

function scoreAccessibility(work, abstractText) {
  let score = 20;

  if (abstractText) {
    score += 35;
  }

  if (work.open_access?.is_oa) {
    score += 25;
  }

  if (work.best_oa_location?.pdf_url || work.primary_location?.pdf_url) {
    score += 10;
  }

  return clampScore(score);
}

function scorePageConnection(question, context, title, abstractText) {
  const haystack = `${title} ${abstractText}`.toLowerCase();
  let score = 10;

  if ((question.normalized || "").split(/\s+/).some((word) => word.length > 5 && haystack.includes(word.toLowerCase()))) {
    score += 30;
  }

  if (context.summary && haystack.includes(context.summary.toLowerCase().split(" ").slice(0, 4).join(" "))) {
    score += 15;
  }

  return clampScore(score);
}

function buildWhyRelevant(question, title, abstractText) {
  const matches = (question.concepts || []).filter((concept) =>
    `${title} ${abstractText}`.toLowerCase().includes(String(concept).toLowerCase())
  );

  if (matches.length) {
    return `It overlaps directly with the question through concepts like ${matches.slice(0, 3).join(", ")}.`;
  }

  return "It appears semantically close to the question raised by the page, but still needs careful reading.";
}

function buildCredibilitySignals(work, institutions, citationCount) {
  const signals = [];

  if (work.primary_location?.source?.display_name) {
    signals.push(`Published via ${work.primary_location.source.display_name}`);
  }

  if (institutions.length) {
    signals.push(`Institution affiliations include ${institutions.slice(0, 2).map((item) => item.name).join(", ")}`);
  }

  if (citationCount) {
    signals.push(`${citationCount} citations in OpenAlex`);
  }

  if (work.doi) {
    signals.push("DOI metadata available");
  }

  signals.push("Science-media attention is not yet connected in this first slice.");
  return signals;
}

function buildLimitations(studyType, population, abstractText) {
  const limitations = [];

  if (studyType === "animal_or_preclinical") {
    limitations.push("This appears to be animal or preclinical evidence, so it may not transfer directly to human behavior.");
  }

  if (!population || /unknown/i.test(population)) {
    limitations.push("The population is not clearly stated in the metadata-level summary.");
  }

  if (!abstractText) {
    limitations.push("This first slice only has limited metadata and no abstract text for deeper interpretation.");
  } else {
    limitations.push("This first slice uses abstract-level evidence, not a full-text paper review.");
  }

  return limitations;
}

function buildExtractedClaims(abstractText) {
  if (!abstractText) {
    return [];
  }

  return abstractText
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 50)
    .slice(0, 2);
}

function buildSummary(abstractText, title) {
  if (abstractText) {
    return abstractText
      .split(/(?<=[.!?])\s+/)
      .slice(0, 2)
      .join(" ")
      .trim();
  }

  return `OpenAlex returned metadata for "${title}", but this first slice did not retrieve an abstract summary.`;
}

function buildConfidenceNotes(studyType, population, citationCount) {
  const notes = [
    "This ranking is heuristic and should not be treated as proof.",
    "This first slice uses metadata and abstract text rather than full-paper reading."
  ];

  if (studyType) {
    notes.push(`Study type appears to be ${studyType.replace(/_/g, " ")}.`);
  }

  if (population) {
    notes.push(`Population signal: ${population}.`);
  }

  if (citationCount < 10) {
    notes.push("Citation influence is still limited or early.");
  }

  return notes;
}

function classifyStudyType(title, abstractText, type) {
  const haystack = `${title} ${abstractText}`.toLowerCase();

  if (/meta-analysis|meta analysis/.test(haystack)) {
    return "meta_analysis";
  }
  if (/systematic review/.test(haystack)) {
    return "systematic_review";
  }
  if (/review/.test(haystack) || type === "review") {
    return "review";
  }
  if (/randomized|randomised|trial/.test(haystack)) {
    return "randomized_trial";
  }
  if (/experiment|experimental/.test(haystack)) {
    return "experiment";
  }
  if (/cohort|longitudinal|cross-sectional|observational/.test(haystack)) {
    return "cohort_or_observational";
  }
  if (/mice|mouse|rat|rats|animal model/.test(haystack)) {
    return "animal_or_preclinical";
  }
  return type || "paper";
}

function inferPopulation(abstractText) {
  const haystack = String(abstractText || "");
  const match = haystack.match(
    /\b(adults?|children|adolescents?|students|patients|participants|older adults|young adults|humans?|mice|rats?)\b/i
  );
  return match ? match[0] : "Unknown from metadata";
}

function extractAuthors(authorships) {
  return authorships
    .map((authorship) => authorship.author?.display_name)
    .filter(Boolean)
    .slice(0, 6);
}

function extractInstitutions(authorships) {
  const institutions = authorships.flatMap((authorship) =>
    (authorship.institutions || []).map((institution) => ({
      name: institution.display_name,
      ror: institution.ror || null
    }))
  );

  const seen = new Set();
  return institutions.filter((institution) => {
    if (!institution.name || seen.has(institution.name)) {
      return false;
    }
    seen.add(institution.name);
    return true;
  }).slice(0, 4);
}

function invertAbstractIndex(index) {
  if (!index || typeof index !== "object") {
    return "";
  }

  const positions = [];
  for (const [word, offsets] of Object.entries(index)) {
    for (const offset of offsets) {
      positions[offset] = word;
    }
  }

  return positions.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function stripDoiPrefix(doi) {
  return String(doi || "").replace(/^https?:\/\/doi.org\//i, "");
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
