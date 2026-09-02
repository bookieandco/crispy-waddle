export type BeatFunction =
  | 'setup'
  | 'action'
  | 'reaction'
  | 'reveal'
  | 'transition'
  | 'dialogue'
  | 'performance'
  | 'emphasis'
  | 'button';

export type ShotTransition =
  | 'cut'
  | 'dissolve'
  | 'fade'
  | 'match-cut'
  | 'whip-pan'
  | 'smash-cut'
  | 'continuous';

export type ShotBeat = {
  id: string;
  startSec: number;
  endSec: number;
  action: string;
  beatFunction: BeatFunction;
  camera?: string;
  dialogue?: string;
  audio?: string;
  characterIds?: string[];
  scene?: string;
  mood?: string;
  microExpression?: string;
  speedRamp?: number;
};

export type ShotTemporalPlan = {
  id: string;
  shotId: string;
  durationSec: number;
  beats: ShotBeat[];
  mustShow: string[];
  transition?: ShotTransition;
  createdAt: string;
  updatedAt: string;
};

function assertFiniteNonNegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`temporal_shot_${field}_invalid`);
}

/** Validates and freezes a temporal plan without mutating the caller's input. */
export function createShotTemporalPlan(input: ShotTemporalPlan): ShotTemporalPlan {
  if (!input.id.trim()) throw new Error('temporal_shot_id_required');
  if (!input.shotId.trim()) throw new Error('temporal_shot_shot_id_required');
  assertFiniteNonNegative(input.durationSec, 'duration');
  if (!input.beats.length) throw new Error('temporal_shot_beats_required');

  let previousEnd = 0;
  for (const beat of input.beats) {
    if (!beat.id.trim()) throw new Error('temporal_shot_beat_id_required');
    assertFiniteNonNegative(beat.startSec, 'beat_start');
    assertFiniteNonNegative(beat.endSec, 'beat_end');
    if (beat.endSec <= beat.startSec) throw new Error(`temporal_shot_beat_range_invalid:${beat.id}`);
    if (beat.startSec < previousEnd) throw new Error(`temporal_shot_beat_overlap:${beat.id}`);
    if (beat.endSec > input.durationSec) throw new Error(`temporal_shot_beat_out_of_bounds:${beat.id}`);
    if (!beat.action.trim()) throw new Error(`temporal_shot_beat_action_required:${beat.id}`);
    if (beat.speedRamp !== undefined && (!Number.isFinite(beat.speedRamp) || beat.speedRamp <= 0)) {
      throw new Error(`temporal_shot_speed_ramp_invalid:${beat.id}`);
    }
    previousEnd = beat.endSec;
  }

  return Object.freeze({
    ...input,
    beats: Object.freeze(input.beats.map((beat) => Object.freeze({ ...beat, characterIds: beat.characterIds ? Object.freeze([...beat.characterIds]) : undefined }))),
    mustShow: Object.freeze([...input.mustShow]),
  });
}

/** Builds the temporal layer from a shot's existing duration/action fields. */
export function temporalPlanFromShot(input: {
  id: string;
  durationSec: number;
  action: string;
  emotion?: string;
  audioNote?: string;
  entityHandles?: string[];
  transition?: ShotTransition;
  createdAt?: string;
  updatedAt?: string;
}): ShotTemporalPlan {
  const now = new Date().toISOString();
  return createShotTemporalPlan({
    id: `temporal:${input.id}`,
    shotId: input.id,
    durationSec: input.durationSec,
    beats: [{
      id: `${input.id}:beat:1`,
      startSec: 0,
      endSec: input.durationSec,
      action: input.action,
      beatFunction: 'action',
      audio: input.audioNote,
      characterIds: input.entityHandles,
      mood: input.emotion,
    }],
    mustShow: [],
    transition: input.transition,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  });
}
