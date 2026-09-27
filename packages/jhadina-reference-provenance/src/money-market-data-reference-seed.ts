import {
  type ReferenceProvenanceRegistry,
} from './index.js';

export const MONEY_MARKET_DATA_REFERENCE_IDS = Object.freeze([
  'github:simonlin1212/global-stock-data',
  'github:je-suis-tm/web-scraping',
  'github:londonstrategicedge/lse-data',
]);

export function registerMoneyMarketDataReferences(
  registry: ReferenceProvenanceRegistry,
): void {
  registry.registerReference({
    referenceId: 'github:simonlin1212/global-stock-data',
    canonicalName: 'global-stock-data',
    kind: 'GITHUB_REPOSITORY',
    roles: ['ARCHITECTURE_REFERENCE', 'ALGORITHM_REFERENCE', 'TEST_REFERENCE'],
    canonicalLocator: 'https://github.com/simonlin1212/global-stock-data',
    sourceRevision: '5f27525709ab043b91e53d7a420ce6d46e66a0ce',
    discoveredFrom: 'USER',
    traceabilityStatus: 'EXTERNALLY_VERIFIED',
    licenseStatus: 'VERIFIED',
    licenseExpression: 'Apache-2.0',
    licenseEvidenceLocator:
      'https://raw.githubusercontent.com/simonlin1212/global-stock-data/5f27525709ab043b91e53d7a420ce6d46e66a0ce/LICENSE',
    notes:
      'Money Core reference for official-source-first market-data acquisition, per-upstream compliance grading, rate limiting, point-in-time data handling and explicit separation between open-source access code and upstream data rights. The repository itself distributes code, not licensed market data.',
    evidence: [
      {
        evidenceId: 'user:money:global-stock-data',
        kind: 'URL',
        locator: 'https://github.com/simonlin1212/global-stock-data',
      },
      {
        evidenceId: 'commit:global-stock-data:5f275257',
        kind: 'COMMIT',
        locator:
          'https://github.com/simonlin1212/global-stock-data/commit/5f27525709ab043b91e53d7a420ce6d46e66a0ce',
      },
    ],
  });

  registry.registerReference({
    referenceId: 'github:je-suis-tm/web-scraping',
    canonicalName: 'web-scraping',
    kind: 'GITHUB_REPOSITORY',
    roles: ['ALGORITHM_REFERENCE', 'TEST_REFERENCE', 'DATA_SOURCE'],
    canonicalLocator: 'https://github.com/je-suis-tm/web-scraping',
    sourceRevision: '5fce1dcdad51a1475864c5ae8134fb675a139205',
    discoveredFrom: 'USER',
    traceabilityStatus: 'EXTERNALLY_VERIFIED',
    licenseStatus: 'VERIFIED',
    licenseExpression: 'Apache-2.0',
    licenseEvidenceLocator:
      'https://raw.githubusercontent.com/je-suis-tm/web-scraping/5fce1dcdad51a1475864c5ae8134fb675a139205/LICENSE',
    notes:
      'Reference for parser/ETL patterns across CFTC, CME, Treasury, LME and SHFE-style public web sources. Endpoints and source terms are not inherited from the code license and must be independently revalidated before runtime use. No access-control bypass or terms-evasion behavior is adopted.',
    evidence: [
      {
        evidenceId: 'user:money:web-scraping',
        kind: 'URL',
        locator: 'https://github.com/je-suis-tm/web-scraping',
      },
      {
        evidenceId: 'commit:web-scraping:5fce1dcd',
        kind: 'COMMIT',
        locator:
          'https://github.com/je-suis-tm/web-scraping/commit/5fce1dcdad51a1475864c5ae8134fb675a139205',
      },
    ],
  });

  registry.registerReference({
    referenceId: 'github:londonstrategicedge/lse-data',
    canonicalName: 'lse-data',
    kind: 'GITHUB_REPOSITORY',
    roles: ['DATA_SOURCE', 'ARCHITECTURE_REFERENCE'],
    canonicalLocator: 'https://github.com/londonstrategicedge/lse-data',
    sourceRevision: '564c63dd99e3b447777cb396314ec6c4342f82ff',
    discoveredFrom: 'USER',
    traceabilityStatus: 'EXTERNALLY_VERIFIED',
    licenseStatus: 'VERIFIED',
    licenseExpression: 'MIT',
    licenseEvidenceLocator:
      'https://raw.githubusercontent.com/londonstrategicedge/lse-data/564c63dd99e3b447777cb396314ec6c4342f82ff/LICENSE',
    notes:
      'Data-source/provider candidate for unified live WebSocket plus REST/Parquet historical market data across stocks, FX, crypto, commodities, indices, ETFs, futures, options, macro and bonds. MIT applies to the client library only; provider data rights are separate and the README states research, trading, model-training and commercial use are allowed while redistribution/resale are restricted.',
    evidence: [
      {
        evidenceId: 'user:money:lse-data',
        kind: 'URL',
        locator: 'https://github.com/londonstrategicedge/lse-data',
      },
      {
        evidenceId: 'commit:lse-data:564c63dd',
        kind: 'COMMIT',
        locator:
          'https://github.com/londonstrategicedge/lse-data/commit/564c63dd99e3b447777cb396314ec6c4342f82ff',
      },
    ],
  });

  registry.registerSourceVerification({
    verificationId: 'verify:global-stock-data:5f275257',
    referenceId: 'github:simonlin1212/global-stock-data',
    canonicalSourceLocator: 'https://github.com/simonlin1212/global-stock-data',
    sourceVerificationStatus: 'PINNED',
    sourceRevision: '5f27525709ab043b91e53d7a420ce6d46e66a0ce',
    sourceDigest:
      'git-commit-sha1:5f27525709ab043b91e53d7a420ce6d46e66a0ce',
    verifiedAt: '2026-09-26T21:55:00Z',
    licenseFinding: 'VERIFIED',
    licenseExpression: 'Apache-2.0',
    licenseEvidenceLocator:
      'https://raw.githubusercontent.com/simonlin1212/global-stock-data/5f27525709ab043b91e53d7a420ce6d46e66a0ce/LICENSE',
    licenseReusePolicy: 'PERMISSIVE',
    notes:
      'Permissive code license does not grant rights to upstream market data. Each upstream source remains separately governed.',
    evidence: [
      {
        evidenceId: 'commit:global-stock-data:5f275257:verify',
        kind: 'COMMIT',
        locator:
          'https://github.com/simonlin1212/global-stock-data/commit/5f27525709ab043b91e53d7a420ce6d46e66a0ce',
      },
    ],
  });

  registry.registerSourceVerification({
    verificationId: 'verify:web-scraping:5fce1dcd',
    referenceId: 'github:je-suis-tm/web-scraping',
    canonicalSourceLocator: 'https://github.com/je-suis-tm/web-scraping',
    sourceVerificationStatus: 'PINNED',
    sourceRevision: '5fce1dcdad51a1475864c5ae8134fb675a139205',
    sourceDigest:
      'git-commit-sha1:5fce1dcdad51a1475864c5ae8134fb675a139205',
    verifiedAt: '2026-09-26T21:55:00Z',
    licenseFinding: 'VERIFIED',
    licenseExpression: 'Apache-2.0',
    licenseEvidenceLocator:
      'https://raw.githubusercontent.com/je-suis-tm/web-scraping/5fce1dcdad51a1475864c5ae8134fb675a139205/LICENSE',
    licenseReusePolicy: 'PERMISSIVE',
    notes:
      'Parser/reference code is permissively licensed; live endpoint legality, terms, freshness and schema compatibility require independent source review.',
    evidence: [
      {
        evidenceId: 'commit:web-scraping:5fce1dcd:verify',
        kind: 'COMMIT',
        locator:
          'https://github.com/je-suis-tm/web-scraping/commit/5fce1dcdad51a1475864c5ae8134fb675a139205',
      },
    ],
  });

  registry.registerSourceVerification({
    verificationId: 'verify:lse-data:564c63dd',
    referenceId: 'github:londonstrategicedge/lse-data',
    canonicalSourceLocator: 'https://github.com/londonstrategicedge/lse-data',
    sourceVerificationStatus: 'PINNED',
    sourceRevision: '564c63dd99e3b447777cb396314ec6c4342f82ff',
    sourceDigest:
      'git-commit-sha1:564c63dd99e3b447777cb396314ec6c4342f82ff',
    verifiedAt: '2026-09-26T21:55:00Z',
    licenseFinding: 'VERIFIED',
    licenseExpression: 'MIT',
    licenseEvidenceLocator:
      'https://raw.githubusercontent.com/londonstrategicedge/lse-data/564c63dd99e3b447777cb396314ec6c4342f82ff/LICENSE',
    licenseReusePolicy: 'PERMISSIVE',
    notes:
      'MIT covers the client library only. Provider data-use rights are a separate contract and must remain separately represented in Money Core.',
    evidence: [
      {
        evidenceId: 'commit:lse-data:564c63dd:verify',
        kind: 'COMMIT',
        locator:
          'https://github.com/londonstrategicedge/lse-data/commit/564c63dd99e3b447777cb396314ec6c4342f82ff',
      },
    ],
  });

  registry.registerMapping({
    mappingId: 'map:money:global-stock-data-source-governance',
    referenceId: 'github:simonlin1212/global-stock-data',
    subsystem: 'Money',
    targetPaths: [
      'packages/money-core/src/market-data-source-contracts.ts',
    ],
    borrowedArtifactKinds: ['IDEA_ONLY', 'INTERFACE_SHAPE'],
    borrowedConcepts: [
      'code-license and data-rights separation',
      'official-source-first data acquisition',
      'per-source compliance classification',
      'source-specific throttling and explicit error semantics',
    ],
    adaptationNotes:
      'Money Core generalizes these ideas into provider-neutral source contracts. No upstream data-access code or source-specific terms are treated as universal.',
    adoptionStatus: 'ADAPTED',
    implementationEvidence: [
      {
        evidenceId: 'repo:money:market-data-source-contracts:global-stock-data',
        kind: 'REPO_PATH',
        locator:
          'repo:packages/money-core/src/market-data-source-contracts.ts',
      },
    ],
    sourceRevision: '5f27525709ab043b91e53d7a420ce6d46e66a0ce',
  });

  registry.registerMapping({
    mappingId: 'map:money:web-scraping-reference-gate',
    referenceId: 'github:je-suis-tm/web-scraping',
    subsystem: 'Money',
    targetPaths: [
      'packages/money-core/src/market-data-source-contracts.ts',
    ],
    borrowedArtifactKinds: ['IDEA_ONLY'],
    borrowedConcepts: [
      'public web parser/ETL reference patterns',
      'JSON endpoint normalization',
      'reference-code versus runtime-provider separation',
    ],
    adaptationNotes:
      'Money Core records scraper repositories as reference code, not production data sources. Any live source requires its own current terms, provenance, quality and point-in-time review.',
    adoptionStatus: 'ADAPTED',
    implementationEvidence: [
      {
        evidenceId: 'repo:money:market-data-source-contracts:web-scraping',
        kind: 'REPO_PATH',
        locator:
          'repo:packages/money-core/src/market-data-source-contracts.ts',
      },
    ],
    sourceRevision: '5fce1dcdad51a1475864c5ae8134fb675a139205',
  });

  registry.registerMapping({
    mappingId: 'map:money:lse-data-provider-rights',
    referenceId: 'github:londonstrategicedge/lse-data',
    subsystem: 'Money',
    targetPaths: [
      'packages/money-core/src/market-data-source-contracts.ts',
    ],
    borrowedArtifactKinds: ['IDEA_ONLY', 'INTERFACE_SHAPE'],
    borrowedConcepts: [
      'unified live and historical multi-asset provider capability',
      'HTTP WebSocket and bulk-export transport separation',
      'client-code license versus provider-data rights',
    ],
    adaptationNotes:
      'Money Core models LSE as a candidate provider contract only. No execution authority is granted and redistribution/resale remain blocked unless provider terms explicitly allow them.',
    adoptionStatus: 'ADAPTED',
    implementationEvidence: [
      {
        evidenceId: 'repo:money:market-data-source-contracts:lse-data',
        kind: 'REPO_PATH',
        locator:
          'repo:packages/money-core/src/market-data-source-contracts.ts',
      },
    ],
    sourceRevision: '564c63dd99e3b447777cb396314ec6c4342f82ff',
  });
}
