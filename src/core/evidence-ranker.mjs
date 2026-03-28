export function rankEvidenceItems(items = []) {
  return [...items].sort((left, right) => {
    const scoreGap = (right.scores?.overall || 0) - (left.scores?.overall || 0);
    if (scoreGap !== 0) {
      return scoreGap;
    }

    return (right.scores?.relevance || 0) - (left.scores?.relevance || 0);
  });
}
