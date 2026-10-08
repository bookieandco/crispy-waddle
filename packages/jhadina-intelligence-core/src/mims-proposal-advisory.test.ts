import { describe, expect, it } from 'vitest';
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
    expect(result.stage).toBe('ASK_JHADINA');
    expect(result.authority).toBe('ADVISORY_ONLY');
    expect(result.canAuthorizeAction).toBe(false);
    expect(result.vote.status).toBe('REVIEW');
    expect(result.vote.checks).toHaveLength(7);
    expect(result.vote.checks.every((check) => check.status === 'REVIEW')).toBe(true);
    expect(result.vote.checks.every((check) => check.evidenceRefs.length === 0)).toBe(true);
    expect(result.independentFactCheckPerformed).toBe(false);
    expect(result.vote.coherentNotEquivalentToTrue).toBe(true);
  });

  it('uses only context-bound evidence IDs and does not elevate them to a truth PASS', () => {
    const context = { ...packet(), knowledge: [ref] };
    const accepted = { ...proposal(), evidence: [ref] };
    const result = assessAskMakeItMakeSense(context, accepted);
    expect(result.vote.checks[0]?.evidenceRefs).toEqual([ref.id]);
    expect(result.vote.checks[0]?.status).toBe('REVIEW');
    expect(result.vote.status).toBe('REVIEW');
    expect(accepted.disposition).toBe('PROCEED');
    expect(accepted.recommendation).toBe('This is an interpretation, not an established fact.');
  });

  it('never accepts forged evidence or model-approved truth claims', () => {
    const forged = {
      ...proposal(),
      evidence: [{ ...ref, id: 'e:invented' }],
    };
    const result = assessAskMakeItMakeSense(packet(), forged);
    expect(result.vote.checks[0]?.evidenceRefs).toEqual([]);
    expect(result.vote.checks[0]?.rationale).toMatch(/excluded/);
    expect(result.vote.status).not.toBe('PASS');
  });

  it('does not throw or credit evidence for proposals referring to the wrong context', () => {
    const wrong = { ...proposal(), contextId: 'ctx:someone-else', evidence: [ref] };
    const result = assessAskMakeItMakeSense({ ...packet(), knowledge: [ref] }, wrong);
    expect(result.vote.subjectId).toBe('ctx:mims-probe');
    expect(result.vote.checks[0]?.evidenceRefs).toEqual([]);
    expect(result.vote.checks[0]?.rationale).toMatch(/does not match/);
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
    expect(check?.status).toBe('REVIEW');
    expect(check?.rationale).toMatch(/1 spatial-context conflict/);
  });
});
