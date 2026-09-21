import assert from 'node:assert/strict';
import test from 'node:test';
import {
  JhadinaSpine,
  type ActionPort,
  type AuditPort,
  type ContextPort,
  type DecisionPort,
  type MemoryPort,
  type PatternPort,
  type PersonalityPort,
  type PolicyPort,
} from '../../jhadina-core-spine/src/index.ts';
import type {
  ContextPacket,
  DecisionProposal,
  Experience,
  MemoryProposal,
  PatternObservation,
  PersonalityState,
  PolicyDecision,
} from '../../jhadina-core-spine/src/types.ts';
import type { EvolutionPort } from '../../jhadina-core-spine/src/evolution.ts';

const experience: Experience = {
  id: 'experience-contract-test',
  occurredAt: '2026-08-24T00:00:00.000Z',
  source: 'contract-test',
  actor: 'user',
  content: 'contract test',
  evidence: [],
};

const memory: MemoryProposal = {
  id: 'memory-contract-test',
  content: 'test memory',
  reason: 'contract test',
  evidence: [],
  disposition: 'PROPOSE',
};

const pattern: PatternObservation = {
  id: 'pattern-contract-test',
  pattern: 'test',
  evidence: [],
  confidence: 1,
  occurrences: 1,
  contradictions: [],
  lastObservedAt: experience.occurredAt,
};

const personality: PersonalityState = {
  version: 1,
  traits: [],
  independentAssessmentRequired: false,
  updatedAt: experience.occurredAt,
};

const context: ContextPacket = {
  id: 'context-contract-test',
  purpose: 'contract test',
  relevantMemories: [],
  patterns: [pattern],
  personality,
  knowledge: [],
  constraints: [],
  excludedContext: [],
};

const decision: DecisionProposal = {
  id: 'proposal-contract-test',
  contextId: context.id,
  disposition: 'PROCEED',
  recommendation: 'execute test action',
  rationale: 'contract test',
  evidence: [],
  uncertainty: [],
  alternatives: [],
};

function createPorts(
  governance: PolicyDecision['disposition'],
  calls: { prepare: number; execute: number; audit: string[] },
) {
  const memoryPort: MemoryPort = {
    async observe() {
      return [memory];
    },
    async loadRelevant() {
      return [];
    },
  };
  const patternPort: PatternPort = {
    async detect() {
      return [pattern];
    },
  };
  const personalityPort: PersonalityPort = {
    async build() {
      return personality;
    },
  };
  const contextPort: ContextPort = {
    async build() {
      return context;
    },
  };
  const decisionPort: DecisionPort = {
    async decide() {
      return decision;
    },
  };
  const policyPort: PolicyPort = {
    async evaluate() {
      return {
        id: 'policy-contract-test',
        proposalId: decision.id,
        disposition: governance,
        reason: 'contract test',
        evaluatedAt: experience.occurredAt,
      };
    },
  };
  const actionPort: ActionPort = {
    async prepare() {
      calls.prepare += 1;
      return {
        id: 'action-contract-test',
        proposalId: decision.id,
        capability: 'contract.test',
        operation: 'execute',
        input: { ok: true },
        reversible: true,
        consequenceLevel: 'low',
      };
    },
    async execute() {
      calls.execute += 1;
      return {
        id: 'result-contract-test',
        requestId: 'action-contract-test',
        success: true,
        completedAt: experience.occurredAt,
      };
    },
  };
  const auditPort: AuditPort = {
    async record(event) {
      calls.audit.push(event.type);
    },
  };
  const evolutionPort: EvolutionPort = {
    async analyze() {
      throw new Error('evolution is outside this contract test');
    },
  };

  return {
    memory: memoryPort,
    pattern: patternPort,
    personality: personalityPort,
    context: contextPort,
    decision: decisionPort,
    policy: policyPort,
    action: actionPort,
    audit: auditPort,
    evolution: evolutionPort,
  };
}

test('DENY stops before Action Core preparation or execution', async () => {
  const calls = { prepare: 0, execute: 0, audit: [] as string[] };
  const spine = new JhadinaSpine(createPorts('DENY', calls));

  const result = await spine.run(experience);

  assert.equal(result.policy.disposition, 'DENY');
  assert.equal(calls.prepare, 0);
  assert.equal(calls.execute, 0);
  assert.deepEqual(calls.audit, ['POLICY_DENIED']);
});

test('APPROVAL_REQUIRED stops at the spine and records a distinct governance event', async () => {
  const calls = { prepare: 0, execute: 0, audit: [] as string[] };
  const spine = new JhadinaSpine(createPorts('APPROVAL_REQUIRED', calls));

  const result = await spine.run(experience);

  assert.equal(result.policy.disposition, 'APPROVAL_REQUIRED');
  assert.equal(calls.prepare, 0);
  assert.equal(calls.execute, 0);
  assert.deepEqual(calls.audit, ['APPROVAL_REQUIRED']);
});

test('ALLOW reaches Action Core preparation and execution exactly once', async () => {
  const calls = { prepare: 0, execute: 0, audit: [] as string[] };
  const spine = new JhadinaSpine(createPorts('ALLOW', calls));

  const result = await spine.run(experience);

  assert.equal(result.policy.disposition, 'ALLOW');
  assert.equal(calls.prepare, 1);
  assert.equal(calls.execute, 1);
  assert.deepEqual(calls.audit, ['DECISION_AUTHORIZED', 'ACTION_COMPLETED']);
});
