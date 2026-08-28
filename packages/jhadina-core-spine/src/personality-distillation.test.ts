import { describe, expect, it } from 'vitest';
import { createPersonalityDistiller } from './personality-distillation.js';

describe('personality distillation', () => {
  it('ignores evidence from another owner', () => {
    const d = createPersonalityDistiller();
    const profile = { ownerId: 'o1', sliders: {}, evidence: [], revision: 0 };
    expect(d.addEvidence(profile, { id: 'e1', ownerId: 'o2', layer: 'expression', trait: 'humor', value: 100, confidence: 90, sourceExperienceIds: ['x'], createdAt: '2026-08-27T00:00:00Z' })).toEqual(profile);
  });

  it('learns a slider from grounded evidence', () => {
    const d = createPersonalityDistiller();
    const profile = { ownerId: 'o1', sliders: {}, evidence: [], revision: 0 };
    const next = d.addEvidence(profile, { id: 'e1', ownerId: 'o1', layer: 'expression', trait: 'humor', value: 80, confidence: 60, sourceExperienceIds: ['x'], createdAt: '2026-08-27T00:00:00Z' });
    expect(next.sliders.humor).toMatchObject({ value: 80 });
  });

  it('lets an explicit correction override learned evidence', () => {
    const d = createPersonalityDistiller();
    const profile = { ownerId: 'o1', sliders: { humor: { value: 90, confidence: 70, sourceExperienceIds: ['x'] } }, evidence: [], revision: 1 };
    const next = d.applyCorrection(profile, 'humor', 20, 'correction-1');
    expect(next.sliders.humor).toMatchObject({ value: 20, confidence: 95 });
  });
});
