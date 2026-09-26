import type { ReferenceProvenanceRegistry } from './index.js';

export const MONEY_INSTITUTIONAL_FLOW_REFERENCE_IDS = Object.freeze([
  'source:money:institutional-flow-marketing-2026-09-26',
]);

export function registerMoneyInstitutionalFlowReferences(
  registry: ReferenceProvenanceRegistry,
): void {
  registry.registerReference({
    referenceId: 'source:money:institutional-flow-marketing-2026-09-26',
    canonicalName: 'Institutional-flow EA marketing transcript',
    kind: 'OTHER',
    roles: ['INSPIRATION', 'TEST_REFERENCE'],
    canonicalLocator:
      'urn:jhadina:user-source:money:institutional-flow-marketing:2026-09-26',
    discoveredFrom: 'USER',
    traceabilityStatus: 'HANDOFF_ONLY',
    licenseStatus: 'UNKNOWN',
    notes:
      'User-supplied marketing transcript asserting near-real-time named-bank FX positioning, Goldman risk-parameter changes, learning from roughly 300 institutional traders, a pre-BOE GBP accumulation example followed by a 380-pip move, more than one million professional decisions processed, a customer return increase from 5% to 16%, and institutional data costs of roughly $2M per trader per year. These are retained as source assertions only; no claim is granted factual, policy, runtime, or execution authority.',
    evidence: [
      {
        evidenceId: 'handoff:money:institutional-flow-marketing:2026-09-26',
        kind: 'HANDOFF_NOTE',
        locator:
          'urn:jhadina:chat-source:institutional-flow-marketing:2026-09-26',
        note:
          'Conversation transcript supplied directly by the user.',
      },
    ],
  });

  registry.registerMapping({
    mappingId: 'map:money:institutional-flow-provenance',
    referenceId: 'source:money:institutional-flow-marketing-2026-09-26',
    subsystem: 'Money',
    targetPaths: [
      'packages/money-core/src/institutional-flow-contracts.ts',
      'packages/money-core/src/fx-intelligence-fusion.ts',
    ],
    borrowedArtifactKinds: ['IDEA_ONLY', 'TEST_PATTERN'],
    borrowedConcepts: [
      'institutional positioning as a distinct FX intelligence channel',
      'learning conditions surrounding professional trading decisions rather than blindly copying orders',
      'continuous pattern learning from time-stamped professional-flow observations',
      'institutional-flow data as a hypothesis source for retail-scale strategy research',
    ],
    adaptationNotes:
      'Money Core separates directly observed participant-classified flow, regulatory/exchange/broker aggregates, inferred flow, public reports, and vendor assertions. Named institutional identities are accepted only from direct participant-classified evidence. Vendor assertions cannot create learnable examples. Every feature used for imitation learning must have been available no later than the observed institutional action, preventing post-event leakage. Learned patterns remain research-only and cannot authorize trades. The transcript-specific bank names, trade sizes, trader counts, BOE story, customer returns, feed pricing, and performance anecdotes are not promoted into facts.',
    adoptionStatus: 'ADAPTED',
    implementationEvidence: [
      {
        evidenceId: 'repo:money:institutional-flow-contracts',
        kind: 'REPO_PATH',
        locator:
          'repo:packages/money-core/src/institutional-flow-contracts.ts',
      },
      {
        evidenceId: 'repo:money:fx-positioning-factor',
        kind: 'REPO_PATH',
        locator:
          'repo:packages/money-core/src/fx-intelligence-fusion.ts',
      },
    ],
  });
}
