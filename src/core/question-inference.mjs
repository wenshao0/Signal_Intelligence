const DOMAIN_KEYWORDS = /(psycholog|neurosci|brain|behavior|behaviour|emotion|stress|anxiety|motivation|habit|sleep|attention|memory|decision|learning|mental health|therapy|social rejection|loneliness|reward)/i;
const MECHANISM_KEYWORDS = /(brain|mechanism|neural|circuit|dopamine|serotonin|cortex|amygdala|stress response)/i;
const CLAIM_KEYWORDS = /(claims?|suggests?|argues?|says?|describes?|implies?|feels?|causes?|leads? to)/i;

export function inferQuestions({ page = {}, userQuestion = "", claimContext = {} } = {}) {
  if (String(userQuestion || "").trim()) {
    return {
      primary: buildQuestion(userQuestion, "user_supplied", "The user explicitly provided the question."),
      alternatives: buildAlternatives(page, claimContext)
    };
  }

  const text = [page.title, page.selectedText, page.articleText, claimContext.mainClaim].filter(Boolean).join(" ");
  const candidates = [];

  if (claimContext.mainClaim) {
    candidates.push(
      buildQuestion(
        `What research is most relevant to checking whether this claim is well supported: ${trimSentence(claimContext.mainClaim)}?`,
        "truth_check",
        "The page appears to make a claim that should be checked against research evidence."
      )
    );
  }

  if (MECHANISM_KEYWORDS.test(text)) {
    candidates.push(
      buildQuestion(
        `What mechanism does research suggest for this claim: ${trimSentence(claimContext.mainClaim || page.title)}?`,
        "mechanism",
        "The page seems to raise a mechanism question, not just a truth-check question."
      )
    );
  }

  if (CLAIM_KEYWORDS.test(text) || DOMAIN_KEYWORDS.test(text)) {
    candidates.push(
      buildQuestion(
        `How strong is the evidence behind this claim, and how far does it generalize?`,
        "scope_check",
        "The page seems to raise a question about the strength and scope of the evidence."
      )
    );
  }

  const ranked = rankQuestions(candidates.length ? candidates : buildAlternatives(page, claimContext));

  return {
    primary: ranked[0] || null,
    alternatives: ranked.slice(1, 3)
  };
}

function buildAlternatives(page, claimContext) {
  const seed = trimSentence(claimContext.mainClaim || page.title || "this page");
  return [
    buildQuestion(
      `What research is most relevant to understanding this claim: ${seed}?`,
      "truth_check",
      "This is the most direct research-evidence question the page raises."
    ),
    buildQuestion(
      `What kind of evidence exists on the mechanism behind this claim?`,
      "mechanism",
      "The page may be implying a mechanism that needs to be checked against research."
    ),
    buildQuestion(
      `How far can this claim generalize beyond the original study setting or sample?`,
      "scope_check",
      "The page may be overstating how broadly the evidence applies."
    )
  ];
}

function rankQuestions(questions = []) {
  const scored = questions.map((question) => ({
    ...question,
    score: scoreQuestion(question)
  }));

  return scored.sort((left, right) => right.score - left.score);
}

function scoreQuestion(question) {
  let score = 50;

  if (question.type === "truth_check") {
    score += 15;
  }
  if (question.type === "mechanism") {
    score += 8;
  }
  if (question.type === "scope_check") {
    score += 6;
  }

  if (question.text.length < 180) {
    score += 5;
  }

  return score;
}

function buildQuestion(text, type, rationale) {
  return {
    text: String(text || "").replace(/\s+/g, " ").trim(),
    type,
    rationale,
    score: 0
  };
}

function trimSentence(value) {
  return String(value || "").replace(/[.!?]+$/, "").trim();
}
