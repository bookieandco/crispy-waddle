import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ContextPacket, DecisionProposal, EvidenceRef } from '@jhadina/core-spine';
import { assessAskMakeItMakeSense } from './mims-proposal-advisory.js';

const ref: EvidenceRef = {
  id: 'e:source-1',
  source: 'verified-context-provider',
  observedAt: '2026-10-08T10:00:00Z',
  summary: 'A reference the model may cite; independent claim validation has not run.',
  immutable: true,
};

function packet(): ContextPacket {
  return {
    id: 'ctx:mims-probe',
    purpose: 'Evaluate an unsupported explanation safely',
    relevantMemories: [],
    patterns: [],
    personality: {
      version: 1,
      traits: [],
      independentAssessmentRequired: true,
      updatedAt: '2026-10-08T10:00:00Z',
    },
    knowledge: [],
    constraints: [],
    excludedContext: [],
  };
}

function proposal(): DecisionProposal {
  return {
    id: 'proposal:mims-probe',
    contextId: 'ctx:mims-probe',
    disposition: 'PROCEED',
    recommendation: 'This is an interpretation, not an established fact.',
    rationale: 'The available information cannot distinguish possible causes.',
    evidence: [],
    uncertainty: ['Independent verification missing'],
    alternatives: ['A different explanation may fit'],
  };
}

describe('JHADINA-PERSONALITY.LIVE MIMS advisory boundary', () => {
  it('reports all seven dimensions as unresolved when no independent validation ran', () => {
    const result = assessAskMakeItMakeSense(packet(), proposal());
    assert.equal(result.stage, 'ASK_JHADINA');
    assert.equal(result.authority, 'ADVISORY_ONLY');
    assert.equal(result.canAuthorizeAction, false);
    assert.equal(result.vote.status, 'REVIEW');
    assert.equal(result.vote.checks.length, 7);
    assert.equal(result.vote.checks.every((check) => check.status === 'REVIEW'), true);
    assert.equal(result.vote.checks.every((check) => check.evidenceRefs.length === 0), true);
    assert.equal(result.independentFactCheckPerformed, false);
    assert.equal(result.vote.coherentNotEquivalentToTrue, true);
  });

  it('uses only context-bound evidence IDs and does not elevate them to a truth PASS', () => {
    const context = { ...packet(), knowledge: [ref] };
    const accepted = { ...proposal(), evidence: [ref] };
    const result = assessAskMakeItMakeSense(context, accepted);
    assert.deepEqual(result.vote.checks[0]?.evidenceRefs, [ref.id]);
    assert.equal(result.vote.checks[0]?.status, 'REVIEW');
    assert.equal(result.vote.status, 'REVIEW');
    assert.equal(accepted.disposition, 'PROCEED');
    assert.equal(accepted.recommendation, 'This is an interpretation, not an established fact.');
  });

  it('never accepts forged evidence or model-approved truth claims', () => {
    const forged = {
      ...proposal(),
      evidence: [{ ...ref, id: 'e:invented' }],
    };
    const result = assessAskMakeItMakeSense(packet(), forged);
    assert.deepEqual(result.vote.checks[0]?.evidenceRefs, []);
    assert.match(result.vote.checks[0]?.rationale ?? '', /excluded/);
    assert.notEqual(result.vote.status, 'PASS');
  });

  it('does not throw or credit evidence for proposals referring to the wrong context', () => {
    const wrong = { ...proposal(), contextId: 'ctx:someone-else', evidence: [ref] };
    const result = assessAskMakeItMakeSense({ ...packet(), knowledge: [ref] }, wrong);
    assert.equal(result.vote.subjectId, 'ctx:mims-probe');
    assert.deepEqual(result.vote.checks[0]?.evidenceRefs, []);
    assert.match(result.vote.checks[0]?.rationale ?? '', /does not match/);
  });

  it('flags reported conflicts for human verification without asserting their truth', () => {
    const context = packet();
    context.domainContext = {
      spatial: {
        observations: [], evidence: [], claims: [], reality: [],
        attention: [], conflicts: ['Two incompatible location claims'],
        uncertainty: [], limitations: [], provenance: [],
      },
    };
    const result = assessAskMakeItMakeSense(context, proposal());
    const check = result.vote.checks.find((item) => item.dimension === 'CONTRADICTIONS');
    assert.equal(check?.status, 'REVIEW');
    assert.match(check?.rationale ?? '', /1 spatial-context conflict/);
  });
});
