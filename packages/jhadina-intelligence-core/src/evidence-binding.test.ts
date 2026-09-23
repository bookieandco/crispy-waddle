import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ContextPacket, DecisionProposal, EvidenceRef } from '@jhadina/core-spine';
import { bindProposalEvidenceToContext, collectContextEvidence } from './evidence-binding.js';

function ref(id: string, source = 'knowledge-core', summary = id): EvidenceRef {
  return {
    id,
    source,
    observedAt: '2026-09-22T12:00:00.000Z',
    summary,
    immutable: false,
  };
}

function context(): ContextPacket {
  return {
    id: 'ctx-evidence',
    purpose: 'test evidence binding',
    relevantMemories: [ref('memory-1', 'memory-core', 'canonical memory')],
    patterns: [{
      id: 'pattern-1',
      pattern: 'cinematic preference',
      evidence: [ref('pattern-evidence-1', 'hippocampus', 'pattern evidence')],
      confidence: 0.8,
      occurrences: 2,
      contradictions: [],
      lastObservedAt: '2026-09-22T12:00:00.000Z',
    }],
    personality: {
      version: 1,
      traits: [{
        id: 'trait-1',
        statement: 'prefers direct answers',
        confidence: 0.9,
        stability: 0.8,
        evidence: [ref('trait-evidence-1', 'personality', 'trait evidence')],
        contradictions: [],
        status: 'accepted',
      }],
      independentAssessmentRequired: false,
      updatedAt: '2026-09-22T12:00:00.000Z',
    },
    knowledge: [ref('knowledge-1', 'knowledge-core', 'canonical knowledge')],
    workSession: {
      id: 'ws-1',
      goal: 'Finish JLLM integration',
      status: 'active',
      activeSubsystems: ['jllm'],
      artifactRefs: [],
      decisionRefs: ['decision-1'],
      outputRefs: [],
      updatedAt: '2026-09-22T12:00:00.000Z',
      evidence: [ref('work-session:ws-1', 'work-session', 'active JLLM work session')],
    },
    constraints: [],
    excludedContext: [],
    artifacts: [{
      id: 'artifact-1',
      kind: 'image',
      mimeType: 'image/png',
      source: 'durable-artifact',
      observedAt: '2026-09-22T12:00:00.000Z',
      name: 'reference.png',
    }],
    domainContext: {
      social: {
        accounts: [ref('social-account-1', 'social-core', 'social account')],
        characters: [],
        pendingWork: [],
        performance: [],
        attention: [],
        uncertainty: [],
        limitations: [],
        provenance: [],
      },
    },
  };
}

function proposal(evidence: EvidenceRef[]): DecisionProposal {
  return {
    id: 'proposal-1',
    contextId: 'ctx-evidence',
    disposition: 'PROCEED',
    recommendation: 'Use the governed evidence.',
    rationale: 'Evidence-backed.',
    evidence,
    uncertainty: [],
    alternatives: [],
  };
}

test('collects canonical evidence across Memory, Knowledge, Personality, domain, and artifacts', () => {
  const ids = collectContextEvidence(context()).map((item) => item.id);
  assert.deepEqual(ids, [
    'memory-1',
    'knowledge-1',
    'pattern-evidence-1',
    'trait-evidence-1',
    'social-account-1',
    'work-session:ws-1',
    'artifact-1',
  ]);
});

test('rebinds known model evidence to canonical ContextPacket values and drops invented evidence', () => {
  const result = bindProposalEvidenceToContext(
    proposal([
      ref('knowledge-1', 'fabricated-source', 'fabricated summary'),
      ref('made-up-id', 'model', 'invented'),
      ref('knowledge-1', 'duplicate', 'duplicate'),
    ]),
    context(),
  );

  assert.deepEqual(result.evidence, [ref('knowledge-1', 'knowledge-core', 'canonical knowledge')]);
  assert.equal(result.uncertainty.length, 1);
  assert.match(result.uncertainty[0] ?? '', /1 provider evidence reference/);
});

test('allows canonical WorkSession provenance evidence but not raw decision/output ids', () => {
  const result = bindProposalEvidenceToContext(
    proposal([
      ref('work-session:ws-1', 'fake', 'fake'),
      ref('decision-1', 'model', 'invented decision details'),
    ]),
    context(),
  );

  assert.deepEqual(result.evidence, [
    ref('work-session:ws-1', 'work-session', 'active JLLM work session'),
  ]);
  assert.match(result.uncertainty.at(-1) ?? '', /1 provider evidence reference/);
});

test('allows an artifact ID but canonicalizes its evidence metadata', () => {
  const result = bindProposalEvidenceToContext(
    proposal([ref('artifact-1', 'fake', 'fake')]),
    context(),
  );

  assert.deepEqual(result.evidence, [{
    id: 'artifact-1',
    source: 'artifact:durable-artifact',
    observedAt: '2026-09-22T12:00:00.000Z',
    summary: 'image artifact reference.png (image/png)',
    immutable: true,
  }]);
  assert.deepEqual(result.uncertainty, []);
});

test('does not mutate the original proposal', () => {
  const original = proposal([ref('made-up-id')]);
  const result = bindProposalEvidenceToContext(original, context());

  assert.equal(original.evidence.length, 1);
  assert.equal(original.uncertainty.length, 0);
  assert.equal(result.evidence.length, 0);
  assert.equal(result.uncertainty.length, 1);
});
