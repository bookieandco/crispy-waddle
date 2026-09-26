import type { ReferenceProvenanceRegistry } from './index.js';

export const MONEY_AUTOMATION_ECON_REFERENCE_IDS = Object.freeze([
  'source:money:ea-automation-claims-2026-09-26',
]);

export function registerMoneyAutomationEconomicsReferences(
  registry: ReferenceProvenanceRegistry,
): void {
  registry.registerReference({
    referenceId: 'source:money:ea-automation-claims-2026-09-26',
    canonicalName: 'EA automation claims transcript',
    kind: 'OTHER',
    roles: ['INSPIRATION', 'TEST_REFERENCE'],
    canonicalLocator:
      'urn:jhadina:user-source:money:ea-automation-claims:2026-09-26',
    discoveredFrom: 'USER',
    traceabilityStatus: 'HANDOFF_ONLY',
    licenseStatus: 'UNKNOWN',
    notes:
      'User-supplied trading-automation marketing/FAQ transcript. Source assertions include a $500 minimum-account recommendation, 10%+ monthly target, $300 monthly subscription, 99.9% infrastructure uptime, demo-account criticism, broker approval claims, development/operational-cost claims, and customer outcome anecdotes. None of these are granted factual, policy, or execution authority.',
    evidence: [
      {
        evidenceId: 'handoff:money:ea-automation-claims:2026-09-26',
        kind: 'HANDOFF_NOTE',
        locator:
          'urn:jhadina:chat-source:ea-automation-claims:2026-09-26',
        note:
          'Conversation transcript supplied directly by the user.',
      },
    ],
  });

  registry.registerMapping({
    mappingId: 'map:money:automation-economics-claims',
    referenceId: 'source:money:ea-automation-claims-2026-09-26',
    subsystem: 'Money',
    targetPaths: [
      'packages/money-core/src/automated-trading-economics-contracts.ts',
    ],
    borrowedArtifactKinds: ['IDEA_ONLY', 'TEST_PATTERN'],
    borrowedConcepts: [
      'capital-size sensitivity to fixed and variable execution costs',
      'spread slippage commission and broker-execution quality as strategy economics',
      'paper-versus-live execution fidelity as a calibration problem',
      'infrastructure uptime as a service metric distinct from strategy returns',
      'vendor return minimum-capital and anecdotal outcome claims as assertions requiring evidence',
    ],
    adaptationNotes:
      'Money Core does not adopt the source-specific $500 minimum, 10% monthly target, demo-is-useless claim, broker preference, subscription payback claim, development-cost claim, or customer anecdotes as facts. Capital viability is derived from modeled edge, turnover, spreads, slippage, commissions and fixed cost. Paper usefulness is assessed by calibration against shadow/live-observed frictions. Broker compatibility is evidence-based. All outputs are research/review only and cannot authorize trades.',
    adoptionStatus: 'ADAPTED',
    implementationEvidence: [
      {
        evidenceId: 'repo:money:automation-economics',
        kind: 'REPO_PATH',
        locator:
          'repo:packages/money-core/src/automated-trading-economics-contracts.ts',
      },
      {
        evidenceId: 'repo:money:automation-economics-tests',
        kind: 'REPO_PATH',
        locator:
          'repo:packages/money-core/src/automated-trading-economics-contracts.test.ts',
      },
    ],
  });
}
