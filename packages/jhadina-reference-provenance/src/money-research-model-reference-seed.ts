import type { ReferenceProvenanceRegistry } from './index.js';

export const MONEY_RESEARCH_MODEL_REFERENCE_IDS = Object.freeze([
  'github:Yonas650/Spotify_Stock_Analysis',
  'github:AmirhosseinHonardoust/Crypto-Price-Equilibrium-Simulator',
]);

export function registerMoneyResearchModelReferences(
  registry: ReferenceProvenanceRegistry,
): void {
  registry.registerReference({
    referenceId: 'github:Yonas650/Spotify_Stock_Analysis',
    canonicalName: 'Spotify_Stock_Analysis',
    kind: 'GITHUB_REPOSITORY',
    roles: ['INSPIRATION', 'TEST_REFERENCE'],
    canonicalLocator: 'https://github.com/Yonas650/Spotify_Stock_Analysis',
    sourceRevision: '2330da56914bcb0814173306c262ba6fd937a4ef',
    discoveredFrom: 'USER',
    traceabilityStatus: 'EXTERNALLY_VERIFIED',
    licenseStatus: 'UNKNOWN',
    notes:
      'Research-workflow reference for stock EDA: returns, rolling statistics, peer correlation, event annotation, alternative/company-specific data ideas, and simple forecast baselines. No repository license was detected, so code reuse is forbidden. The notebook random-splits time-series data for next-day prediction, which is rejected as certification evidence because it can mix future and past observations. Embedded API credentials are also excluded from adoption.',
    evidence: [
      {
        evidenceId: 'user:money:spotify-stock-analysis',
        kind: 'URL',
        locator: 'https://github.com/Yonas650/Spotify_Stock_Analysis',
      },
      {
        evidenceId: 'commit:spotify-stock-analysis:2330da56',
        kind: 'COMMIT',
        locator:
          'https://github.com/Yonas650/Spotify_Stock_Analysis/commit/2330da56914bcb0814173306c262ba6fd937a4ef',
      },
    ],
  });

  registry.registerReference({
    referenceId:
      'github:AmirhosseinHonardoust/Crypto-Price-Equilibrium-Simulator',
    canonicalName: 'Crypto-Price-Equilibrium-Simulator',
    kind: 'GITHUB_REPOSITORY',
    roles: [
      'ALGORITHM_REFERENCE',
      'ARCHITECTURE_REFERENCE',
      'TEST_REFERENCE',
    ],
    canonicalLocator:
      'https://github.com/AmirhosseinHonardoust/Crypto-Price-Equilibrium-Simulator',
    sourceRevision: 'f47f4f9c498f9c1548868b4981bae2be98a9d144',
    discoveredFrom: 'USER',
    traceabilityStatus: 'EXTERNALLY_VERIFIED',
    licenseStatus: 'VERIFIED',
    licenseExpression: 'MIT',
    licenseEvidenceLocator:
      'https://raw.githubusercontent.com/AmirhosseinHonardoust/Crypto-Price-Equilibrium-Simulator/f47f4f9c498f9c1548868b4981bae2be98a9d144/LICENSE',
    notes:
      'Reference for transparent force decomposition, heuristic equilibrium bands, tension diagnostics and what-if scenario shocks. The upstream model explicitly describes itself as interpretive rather than predictive. Money Core independently re-implements the concept with signed force semantics, non-negative combination weights, explicit calibration status and zero execution authority.',
    evidence: [
      {
        evidenceId: 'user:money:crypto-equilibrium-simulator',
        kind: 'URL',
        locator:
          'https://github.com/AmirhosseinHonardoust/Crypto-Price-Equilibrium-Simulator',
      },
      {
        evidenceId: 'commit:crypto-equilibrium:f47f4f9c',
        kind: 'COMMIT',
        locator:
          'https://github.com/AmirhosseinHonardoust/Crypto-Price-Equilibrium-Simulator/commit/f47f4f9c498f9c1548868b4981bae2be98a9d144',
      },
    ],
  });

  registry.registerSourceVerification({
    verificationId: 'verify:spotify-stock-analysis:2330da56',
    referenceId: 'github:Yonas650/Spotify_Stock_Analysis',
    canonicalSourceLocator:
      'https://github.com/Yonas650/Spotify_Stock_Analysis',
    sourceVerificationStatus: 'PINNED',
    sourceRevision: '2330da56914bcb0814173306c262ba6fd937a4ef',
    sourceDigest:
      'git-commit-sha1:2330da56914bcb0814173306c262ba6fd937a4ef',
    verifiedAt: '2026-09-26T22:10:00Z',
    licenseFinding: 'NO_LICENSE_FILE',
    licenseReusePolicy: 'NO_LICENSE',
    notes:
      'GitHub repository metadata reports no detected license and the root contains no LICENSE file. Reference/evaluation only; no code reuse.',
    evidence: [
      {
        evidenceId: 'commit:spotify-stock-analysis:2330da56:verify',
        kind: 'COMMIT',
        locator:
          'https://github.com/Yonas650/Spotify_Stock_Analysis/commit/2330da56914bcb0814173306c262ba6fd937a4ef',
      },
    ],
  });

  registry.registerSourceVerification({
    verificationId: 'verify:crypto-equilibrium:f47f4f9c',
    referenceId:
      'github:AmirhosseinHonardoust/Crypto-Price-Equilibrium-Simulator',
    canonicalSourceLocator:
      'https://github.com/AmirhosseinHonardoust/Crypto-Price-Equilibrium-Simulator',
    sourceVerificationStatus: 'PINNED',
    sourceRevision: 'f47f4f9c498f9c1548868b4981bae2be98a9d144',
    sourceDigest:
      'git-commit-sha1:f47f4f9c498f9c1548868b4981bae2be98a9d144',
    verifiedAt: '2026-09-26T22:10:00Z',
    licenseFinding: 'VERIFIED',
    licenseExpression: 'MIT',
    licenseEvidenceLocator:
      'https://raw.githubusercontent.com/AmirhosseinHonardoust/Crypto-Price-Equilibrium-Simulator/f47f4f9c498f9c1548868b4981bae2be98a9d144/LICENSE',
    licenseReusePolicy: 'PERMISSIVE',
    notes:
      'MIT source is pinned for algorithmic comparison. Money Core still treats the model as unvalidated research until independent out-of-sample calibration exists.',
    evidence: [
      {
        evidenceId: 'commit:crypto-equilibrium:f47f4f9c:verify',
        kind: 'COMMIT',
        locator:
          'https://github.com/AmirhosseinHonardoust/Crypto-Price-Equilibrium-Simulator/commit/f47f4f9c498f9c1548868b4981bae2be98a9d144',
      },
    ],
  });

  registry.registerMapping({
    mappingId: 'map:money:spotify-stock-analysis-workflow',
    referenceId: 'github:Yonas650/Spotify_Stock_Analysis',
    subsystem: 'Money',
    targetPaths: [
      'packages/money-core/src/information-analysis-engine.ts',
      'packages/money-core/src/issuer-reality-contracts.ts',
      'packages/money-core/src/fundamental-normalization-contracts.ts',
    ],
    borrowedArtifactKinds: ['IDEA_ONLY'],
    borrowedConcepts: [
      'rolling return and volatility exploration',
      'peer return correlation analysis',
      'event annotation and external-factor research',
      'company-specific alternative-data hypothesis generation',
      'simple forecast model as a baseline to challenge',
    ],
    adaptationNotes:
      'Evaluated as a research-workflow reference only. Money Core rejects random time-series train/test splitting for forecast certification, requires point-in-time source provenance for events and alternative data, and does not reuse embedded credentials or notebook source code.',
    adoptionStatus: 'EVALUATED',
    implementationEvidence: [
      {
        evidenceId: 'repo:money:information-analysis',
        kind: 'REPO_PATH',
        locator:
          'repo:packages/money-core/src/information-analysis-engine.ts',
      },
      {
        evidenceId: 'repo:money:issuer-reality',
        kind: 'REPO_PATH',
        locator:
          'repo:packages/money-core/src/issuer-reality-contracts.ts',
      },
    ],
    sourceRevision: '2330da56914bcb0814173306c262ba6fd937a4ef',
  });

  registry.registerMapping({
    mappingId: 'map:money:market-force-equilibrium',
    referenceId:
      'github:AmirhosseinHonardoust/Crypto-Price-Equilibrium-Simulator',
    subsystem: 'Money',
    targetPaths: [
      'packages/money-core/src/market-force-equilibrium-contracts.ts',
    ],
    borrowedArtifactKinds: ['IDEA_ONLY', 'ALGORITHM', 'TEST_PATTERN'],
    borrowedConcepts: [
      'interpretable demand supply volatility liquidity speculation force vector',
      'equilibrium-shift diagnostic',
      'force-disagreement tension score',
      'scenario shock analysis',
      'market-wide diagnostic rather than direct price prediction',
    ],
    adaptationNotes:
      'Money Core independently implements the idea with a single signed-force convention and non-negative weights so volatility cannot be accidentally double-negated. Weights are explicit model inputs, outputs are labeled heuristic/interpretive, calibration status is mandatory, and diagnostics cannot authorize trades.',
    adoptionStatus: 'ADAPTED',
    implementationEvidence: [
      {
        evidenceId: 'repo:money:market-force-equilibrium',
        kind: 'REPO_PATH',
        locator:
          'repo:packages/money-core/src/market-force-equilibrium-contracts.ts',
      },
    ],
    sourceRevision: 'f47f4f9c498f9c1548868b4981bae2be98a9d144',
  });
}
