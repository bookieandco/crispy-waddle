import { describe, expect, it, vi } from 'vitest';
import { analyzeTasteEvolution, createTasteImprovementInputs } from './taste-evolution-adapter.js';
import type { EvolutionPort } from './evolution.js';
import type { PersonalityCandidate } from './taste-personality-bridge.js';

const candidate: PersonalityCandidate = {
  trait: 'taste.genre.psychological thriller', value: 85, confidence: 65,
  evidenceIds: ['e1', 'e2', 'e3'], status: 'candidate', reason: 'Repeated preference',
};

describe('taste evolution adapter', () => {
  it('turns taste candidates into evidence-backed improvement inputs', () => {
    const [input] = createTasteImprovementInputs({ ownerId: 'owner-a', candidates: [candidate], observedAt: '2026-08-27T00:00:00.000Z' });
    expect(input).toMatchObject({ source: 'observation', title: 'Taste candidate: taste.genre.psychological thriller' });
    expect(input.evidence).toHaveLength(3);
    expect(input.evidence[0]).toMatchObject({ type: 'experience', reference: 'e1' });
  });

  it('delegates promotion analysis without promoting anything', async () => {
    const analyze = vi.fn().mockResolvedValue({ id: 'p1', inputId: 'i1', kind: 'personality', title: 'taste', problem: 'p', proposedChange: 'c', rationale: 'r', expectedBenefit: 'b', risks: [], dependencies: [], affectedDomains: ['media'], evidence: [], confidence: 65, reversible: true, requiresApproval: true, status: 'awaiting_approval' });
    const evolution = { analyze } as unknown as EvolutionPort;
    const [proposal] = await analyzeTasteEvolution({ ownerId: 'owner-a', candidates: [candidate], observedAt: '2026-08-27T00:00:00.000Z' }, evolution);
    expect(analyze).toHaveBeenCalledOnce();
    expect(proposal.status).toBe('awaiting_approval');
  });
});
