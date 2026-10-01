import type { ReferenceProvenanceRegistry } from './index.js';

export const MONEY_PAPER_TUTORIAL_REFERENCE_IDS = Object.freeze([
  'youtube:_o-e4SqaieQ',
  'youtube:u-WxsvHVWN8',
]);

export function registerMoneyPaperTutorialReferences(
  registry: ReferenceProvenanceRegistry,
): void {
  registry.registerReference({
    referenceId: 'youtube:_o-e4SqaieQ',
    canonicalName: 'TradingView Paper Trading Tutorial For Beginners (2026)',
    kind: 'OTHER',
    roles: ['INSPIRATION', 'TEST_REFERENCE'],
    canonicalLocator: 'https://www.youtube.com/watch?v=_o-e4SqaieQ',
    discoveredFrom: 'USER',
    traceabilityStatus: 'EXTERNALLY_VERIFIED',
    licenseStatus: 'UNKNOWN',
    notes:
      'Ryan Scribner tutorial supplied by the user. Useful paper-trading concepts include realistic starting capital, leverage/margin controls, optional commissions, order types, stop-loss/take-profit exits, realized versus unrealized P&L, order/balance history, and the warning that paper success is not equivalent to live readiness. Tutorial-specific market explanations and promotional/affiliate material have no factual, policy, or execution authority.',
    evidence: [
      {
        evidenceId: 'youtube:_o-e4SqaieQ:metadata',
        kind: 'URL',
        locator: 'https://www.youtube.com/watch?v=_o-e4SqaieQ',
      },
    ],
  });

  registry.registerReference({
    referenceId: 'youtube:u-WxsvHVWN8',
    canonicalName: 'TradingView Paper Trading Tutorial (Easy Setup & Trading)',
    kind: 'OTHER',
    roles: ['INSPIRATION', 'TEST_REFERENCE'],
    canonicalLocator: 'https://www.youtube.com/watch?v=u-WxsvHVWN8',
    discoveredFrom: 'USER',
    traceabilityStatus: 'EXTERNALLY_VERIFIED',
    licenseStatus: 'UNKNOWN',
    notes:
      'MoneyZG tutorial supplied by the user. Useful concepts include separate paper accounts for different strategies, commission realism, working/cancelled limit orders, market orders, bracket-style entry plus stop-loss plus take-profit, realized/unrealized P&L and explicit maximum-loss planning. TradingView UI behavior and affiliate/provider claims are not adopted as product policy.',
    evidence: [
      {
        evidenceId: 'youtube:u-WxsvHVWN8:metadata',
        kind: 'URL',
        locator: 'https://www.youtube.com/watch?v=u-WxsvHVWN8',
      },
    ],
  });

  registry.registerMapping({
    mappingId: 'map:money:paper-trading-tutorials',
    referenceId: 'youtube:_o-e4SqaieQ',
    subsystem: 'Money',
    targetPaths: [
      'packages/money-core/src/paper-realism-profile.ts',
      'packages/money-core/src/paper-autopilot-settings.ts',
      'packages/money-core/src/alpaca-trading-adapter.ts',
      'packages/money-core/src/paper-learning-loop.ts',
    ],
    borrowedArtifactKinds: ['IDEA_ONLY', 'TEST_PATTERN'],
    borrowedConcepts: [
      'realistic paper account size instead of fantasy capital',
      'explicit leverage and margin configuration',
      'commissions and execution friction as paper-fidelity inputs',
      'realized versus unrealized P&L as distinct states',
      'stop-loss and take-profit planning',
      'paper success does not establish live readiness',
    ],
    adaptationNotes:
      'Money Core converts tutorial concepts into provider-neutral, evidence-bound contracts. Paper realism is explicit, paper success cannot authorize live trading, and MIMS/strategy calibration remain separate. The tutorial statement that green volume means more buyers than sellers and red volume means more sellers than buyers is not adopted: executed volume always has a buyer and seller, while trade-direction/order-flow inference belongs to the microstructure layer.',
    adoptionStatus: 'ADAPTED',
    implementationEvidence: [
      {
        evidenceId: 'repo:money:paper-realism',
        kind: 'REPO_PATH',
        locator: 'repo:packages/money-core/src/paper-realism-profile.ts',
      },
      {
        evidenceId: 'repo:money:paper-loop',
        kind: 'REPO_PATH',
        locator: 'repo:packages/money-core/src/paper-learning-loop.ts',
      },
    ],
  });

  registry.registerMapping({
    mappingId: 'map:money:paper-bracket-orders',
    referenceId: 'youtube:u-WxsvHVWN8',
    subsystem: 'Money',
    targetPaths: [
      'packages/money-core/src/alpaca-trading-adapter.ts',
      'packages/money-core/src/paper-autopilot-settings.ts',
    ],
    borrowedArtifactKinds: ['IDEA_ONLY', 'TEST_PATTERN'],
    borrowedConcepts: [
      'separate paper configurations for different strategy families',
      'linked entry stop-loss and take-profit risk plan',
      'order working cancellation and close-state visibility',
      'known maximum loss before an automated paper entry',
    ],
    adaptationNotes:
      'The TradingView interaction model is not copied. Money Core independently implements paper-only Alpaca bracket semantics and requires explicit stop/take-profit settings. Bracket geometry is validated before provider submission and cannot grant live authority.',
    adoptionStatus: 'ADAPTED',
    implementationEvidence: [
      {
        evidenceId: 'repo:money:alpaca-paper-bracket',
        kind: 'REPO_PATH',
        locator: 'repo:packages/money-core/src/alpaca-trading-adapter.ts',
      },
    ],
  });
}
