import { describe, expect, it } from 'vitest';
import { createShotTemporalPlan, temporalPlanFromShot } from './temporal-shot-plan';

describe('temporal shot plan', () => {
  const base = {
    id: 'temporal:shot-1',
    shotId: 'shot-1',
    durationSec: 4,
    beats: [
      { id: 'b1', startSec: 0, endSec: 1, action: 'look up', beatFunction: 'setup' as const },
      { id: 'b2', startSec: 1, endSec: 4, action: 'deliver line', beatFunction: 'dialogue' as const, speedRamp: 1.1 },
    ],
    mustShow: ['red jacket'],
    createdAt: '2026-09-02T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
  };

  it('accepts ordered, bounded micro-beats', () => {
    expect(createShotTemporalPlan(base).beats).toHaveLength(2);
  });

  it('rejects overlaps', () => {
    expect(() => createShotTemporalPlan({ ...base, beats: [base.beats[0], { ...base.beats[1], startSec: 0.5 }] })).toThrow('temporal_shot_beat_overlap');
  });

  it('rejects beats outside the shot duration', () => {
    expect(() => createShotTemporalPlan({ ...base, beats: [{ ...base.beats[0], endSec: 5 }] })).toThrow('temporal_shot_beat_out_of_bounds');
  });

  it('rejects invalid speed ramps', () => {
    expect(() => createShotTemporalPlan({ ...base, beats: [{ ...base.beats[0], speedRamp: 0 }] })).toThrow('temporal_shot_speed_ramp_invalid');
  });

  it('does not mutate caller-owned arrays', () => {
    const plan = createShotTemporalPlan(base);
    expect(plan.beats).not.toBe(base.beats);
    expect(plan.mustShow).not.toBe(base.mustShow);
  });

  it('adapts the existing Shot contract without duplicating it', () => {
    const plan = temporalPlanFromShot({
      id: 'shot-7',
      durationSec: 3,
      action: 'turn toward camera',
      emotion: 'surprised',
      audioNote: 'room tone',
      entityHandles: ['character-1'],
      transition: 'cut',
    });
    expect(plan.shotId).toBe('shot-7');
    expect(plan.beats[0].action).toBe('turn toward camera');
    expect(plan.beats[0].characterIds).toEqual(['character-1']);
  });
});
