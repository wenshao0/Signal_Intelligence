export function assessEvidenceSufficiency(evidence = []) {
  if (!evidence.length) {
    return {
      status: "insufficient_evidence",
      message: "No relevant research papers were retrieved for this question yet."
    };
  }

  const strongCount = evidence.filter((item) => (item.scores?.overall || 0) >= 70).length;
  if (!strongCount) {
    return {
      status: "insufficient_evidence",
      message: "Relevant papers were found, but the current evidence is still too weak or indirect for a confident research summary."
    };
  }

  return {
    status: "ok",
    message: ""
  };
}
