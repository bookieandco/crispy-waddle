const { rankCandidates } = require('./candidate-ranking');

function buildRankingReport(input) {
  const ranked = rankCandidates(input);
  const best = ranked[0] || null;

  return {
    generatedAt: new Date().toISOString(),
    candidateCount: ranked.length,
    bestMatch: best,
    candidates: ranked,
    gate: {
      identityDecision: 'NOT_DETERMINED',
      entitlementDecision: 'NOT_DETERMINED',
      humanReviewRequired: true,
      outreachDecision: 'BLOCKED',
    },
  };
}

module.exports = { buildRankingReport };
