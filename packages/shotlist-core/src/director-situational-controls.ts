import type { DirectorControls } from './types.js';
import type { BehavioralState } from '@jhadina/core-spine';

export interface DirectorSituation {
  storyIntent?: 'comedy' | 'drama' | 'action' | 'romance' | 'horror' | 'neutral';
  emotionalWeight?: number;
}

export function applySituationalDirectorState(
  controls: DirectorControls,
  state: BehavioralState,
  situation: DirectorSituation = {},
): DirectorControls {
  const next = { ...controls };
  const serious = state.mode === 'serious' || state.mode === 'urgent' || state.mode === 'sensitive';

  if (serious && (situation.emotionalWeight ?? 0) >= 70) {
    next.cameraMovement ??= 'slow';
    next.framing ??= 'close-up';
  }

  if (state.mode === 'urgent' || situation.storyIntent === 'action') {
    next.cameraMovement ??= 'handheld';
  }

  if (situation.storyIntent === 'comedy' && state.sliders.humor >= 60) {
    next.cameraMovement ??= 'dynamic';
  }

  return next;
}
