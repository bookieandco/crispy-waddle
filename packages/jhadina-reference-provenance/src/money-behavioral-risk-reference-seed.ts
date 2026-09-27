import type { ReferenceProvenanceRegistry } from './index.js';

export const MONEY_BEHAVIORAL_RISK_REFERENCE_IDS = Object.freeze([
  'source:money:trading-psychology-marketing-2026-09-26',
]);

export function registerMoneyBehavioralRiskReferences(
  registry: ReferenceProvenanceRegistry,
): void {
  registry.registerReference({
    referenceId: 'source:money:trading-psychology-marketing-2026-09-26',
    canonicalName: 'Trading psychology and automation marketing transcript',
    kind: 'OTHER',
    roles: ['INSPIRATION', 'TEST_REFERENCE'],
    canonicalLocator:
      'urn:jhadina:user-source:money:trading-psychology-marketing:2026-09-26',
    discoveredFrom: 'USER',
    traceabilityStatus: 'HANDOFF_ONLY',
    licenseStatus: 'UNKNOWN',
    notes:
      'User-supplied marketing transcript emphasizing discipline, revenge-trade avoidance, long-horizon consistency, automation of execution, compounding, and human oversight. Source also asserts a 90% lottery-winner statistic, nine-out-of-ten trader burnout, up-to-20%-monthly returns, hedge-fund comparisons, trained-on-thousands-of-trades language, and predictable compound growth. Those claims are retained as assertions only and are not granted factual, policy, runtime, or execution authority.',
    evidence: [
      {
        evidenceId: 'handoff:money:trading-psychology-marketing:2026-09-26',
        kind: 'HANDOFF_NOTE',
        locator:
          'urn:jhadina:chat-source:trading-psychology-marketing:2026-09-26',
        note:
          'Conversation transcript supplied directly by the user.',
      },
    ],
  });

  registry.registerMapping({
    mappingId: 'map:money:behavioral-risk-process-consistency',
    referenceId: 'source:money:trading-psychology-marketing-2026-09-26',
    subsystem: 'Money',
    targetPaths: [
      'packages/money-core/src/behavioral-risk-contracts.ts',
    ],
    borrowedArtifactKinds: ['IDEA_ONLY', 'TEST_PATTERN'],
    borrowedConcepts: [
      'revenge-trade and loss-chasing as observable risk-escalation patterns',
      'process consistency across time rather than single-period profit',
      'constant-fraction equity scaling instead of gambling-style size escalation',
      'strategy churn and rule overrides as reviewable process risks',
      'automation discipline as distinct from strategy edge',
    ],
    adaptationNotes:
      'Money Core does not infer private mental state. It only detects observable execution/process patterns such as post-loss risk escalation, rapid re-entry, rule overrides, and strategy churn. Constant-fraction scaling lets absolute risk rise with equity while keeping the risk fraction bounded; Martingale and recent-PnL-driven risk escalation remain forbidden. Process stability is evaluated separately from profitability and cannot authorize trades. The transcript-specific failure-rate statistics, 20%-monthly claim, hedge-fund comparison, predictable-growth language, and marketing outcomes are not promoted into facts.',
    adoptionStatus: 'ADAPTED',
    implementationEvidence: [
      {
        evidenceId: 'repo:money:behavioral-risk-contracts',
        kind: 'REPO_PATH',
        locator:
          'repo:packages/money-core/src/behavioral-risk-contracts.ts',
      },
      {
        evidenceId: 'repo:money:behavioral-risk-tests',
        kind: 'REPO_PATH',
        locator:
          'repo:packages/money-core/src/behavioral-risk-contracts.test.ts',
      },
    ],
  });
}
