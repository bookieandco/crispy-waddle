import type { ReferenceProvenanceRegistry } from './index.js';

export const MONEY_TRADING_FOUNDATION_REFERENCE_IDS = Object.freeze([
  'source:money:trading-foundations-2026-09-26',
]);

export function registerMoneyTradingFoundationReferences(
  registry: ReferenceProvenanceRegistry,
): void {
  registry.registerReference({
    referenceId: 'source:money:trading-foundations-2026-09-26',
    canonicalName: 'Beginner options and futures trading foundations transcript',
    kind: 'OTHER',
    roles: ['INSPIRATION', 'TEST_REFERENCE'],
    canonicalLocator:
      'urn:jhadina:user-source:money:trading-foundations:2026-09-26',
    discoveredFrom: 'USER',
    traceabilityStatus: 'HANDOFF_ONLY',
    licenseStatus: 'UNKNOWN',
    notes:
      'User-supplied educational transcript used as a conceptual source for paper-first learning, foundational chart skills, option/futures vehicle distinctions, and beginner terminology. Money Core does not copy the transcript and does not treat promotional earnings claims, broker preferences, fixed market hours, or cross-market strategy portability as verified facts.',
    evidence: [
      {
        evidenceId: 'handoff:money:trading-foundations:turn213file0',
        kind: 'HANDOFF_NOTE',
        locator:
          'urn:jhadina:chat-source:turn213file0',
        note:
          'Conversation attachment supplied by the user on 2026-09-26.',
      },
    ],
  });

  registry.registerMapping({
    mappingId: 'map:money:trader-readiness-foundations',
    referenceId: 'source:money:trading-foundations-2026-09-26',
    subsystem: 'Money',
    targetPaths: [
      'packages/money-core/src/trader-readiness-contracts.ts',
      'packages/money-core/src/trading-vehicle-semantics.ts',
      'packages/money-core/src/financial-intelligence-contracts.ts',
    ],
    borrowedArtifactKinds: ['IDEA_ONLY', 'TEST_PATTERN'],
    borrowedConcepts: [
      'paper-first learning before real-money trading',
      'candlestick OHLC market-structure and trend foundations',
      'options and futures as distinct trading vehicles',
      'long-call bullish and long-put bearish beginner use cases',
      'risk management as a prerequisite for progression',
    ],
    adaptationNotes:
      'Money Core converts the educational concepts into governed readiness evidence. Passive study is insufficient; paper profit alone is insufficient; live authority remains impossible from readiness assessment. Chart primitives may transfer across vehicles, but strategy edge requires independent target-market validation. Futures roll and market-hours claims are normalized to contract/venue-specific semantics rather than copied literally.',
    adoptionStatus: 'ADAPTED',
    implementationEvidence: [
      {
        evidenceId: 'repo:money:trader-readiness-foundations',
        kind: 'REPO_PATH',
        locator:
          'repo:packages/money-core/src/trader-readiness-contracts.ts',
      },
      {
        evidenceId: 'repo:money:trading-vehicle-semantics',
        kind: 'REPO_PATH',
        locator:
          'repo:packages/money-core/src/trading-vehicle-semantics.ts',
      },
      {
        evidenceId: 'repo:money:financial-intelligence-option-future',
        kind: 'REPO_PATH',
        locator:
          'repo:packages/money-core/src/financial-intelligence-contracts.ts',
      },
    ],
  });
}
