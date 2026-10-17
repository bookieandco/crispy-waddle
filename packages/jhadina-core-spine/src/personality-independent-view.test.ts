import { describe, expect, it } from 'vitest';
import { emptyPersonalityState } from './personality-core.js';
import { readIndependentPersonalityView } from './personality-independent-view.js';

const evidence = [1,2,3].map(index => ({
  id: 'approved-observation-' + index,
  source: 'governed-experience',
  observedAt: '2026-10-0' + index + 'T00:00:00Z',
  summary: 'Original visual identity with deliberate restraint',
  immutable: true,
}));

describe('LIVE.6 independent grounded view', () => {
  const base = emptyPersonalityState('2026-10-17T00:00:00Z');
  const state = {
    ...base,
    traits: [{
      id: 'jhadina-own-taste',
      statement: 'I prefer restrained visual direction over clutter',
      dimension: 'taste' as const,
      confidence: 0.9, stability: 0.84,
      evidence, contradictions: [], status: 'accepted' as const,
    }],
  };
  it('maintains a distinct evidenced view even if owner prefers the opposite', () => {
    const view = readIndependentPersonalityView(state, 'jhadina-own-taste', 'I love clutter');
    expect(view?.differsFromUserPreference).toBe(true);
    expect(view?.evidenceIds).toHaveLength(3);
    expect(view?.source).toBe('governed-personality-trait');
  });
  it('never infers autonomous opinions from weak, contested, mutable or invented traits', () => {
    expect(readIndependentPersonalityView(base,'unknown')).toBeUndefined();
    expect(readIndependentPersonalityView({...state,traits:[{...state.traits[0]!,status:'contested' as const}]},'jhadina-own-taste')).toBeUndefined();
    expect(readIndependentPersonalityView({...state,traits:[{...state.traits[0]!,evidence:evidence.slice(0,2)}]},'jhadina-own-taste')).toBeUndefined();
    expect(readIndependentPersonalityView({...state,traits:[{...state.traits[0]!,evidence:evidence.map(ref=>({...ref,immutable:false}))}]},'jhadina-own-taste')).toBeUndefined();
  });
});
