import type { BehavioralState } from '@jhadina/core-spine';
import { applyDirectorTasteToControls } from './director-taste-controls.js';
import { applySituationalDirectorState, type DirectorSituation } from './director-situational-controls.js';
import type { DirectorTasteProfile } from './director-taste.js';
import type { DirectorControls } from './types.js';

export type DirectorControlSource = 'explicit' | 'situational' | 'taste' | 'default';

export interface DirectorDecision {
  controls: DirectorControls;
  sources: Partial<Record<keyof DirectorControls, DirectorControlSource>>;
}

export interface ResolveDirectorDecisionInput {
  explicit: DirectorControls;
  defaults?: DirectorControls;
  taste: DirectorTasteProfile;
  behavior: BehavioralState;
  situation?: DirectorSituation;
}

export function resolveDirectorDecision(input: ResolveDirectorDecisionInput): DirectorDecision {
  const withTaste = applyDirectorTasteToControls({ ...(input.defaults ?? {}), ...input.explicit }, input.taste);
  const controls = applySituationalDirectorState(withTaste, input.behavior, input.situation);
  const sources: Partial<Record<keyof DirectorControls, DirectorControlSource>> = {};

  for (const key of Object.keys(controls) as (keyof DirectorControls)[]) {
    if (input.explicit[key] !== undefined) sources[key] = 'explicit';
    else if (withTaste[key] !== controls[key]) sources[key] = 'situational';
    else if (withTaste[key] !== undefined && input.defaults?.[key] === undefined) sources[key] = 'taste';
    else if (input.defaults?.[key] !== undefined) sources[key] = 'default';
  }
  return { controls, sources };
}
