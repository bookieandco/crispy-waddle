import type { DirectorTasteProfile } from './director-taste.js';
import type { DirectorControls } from './types.js';

function preferred(profile: DirectorTasteProfile, category: string, fallback?: string): string | undefined {
  const matches = (profile.signals ?? []).filter((s) => s.category === category && s.confidence >= 50 && s.sentiment > 0);
  matches.sort((a, b) => b.sentiment * b.confidence - a.sentiment * a.confidence);
  return matches[0]?.subject ?? fallback;
}

export function applyDirectorTasteToControls(
  controls: DirectorControls,
  profile: DirectorTasteProfile,
): DirectorControls {
  return {
    ...controls,
    framing: controls.framing ?? preferred(profile, 'framing'),
    cameraMovement: controls.cameraMovement ?? preferred(profile, 'cameraMovement'),
    lightingMood: controls.lightingMood ?? preferred(profile, 'lightingMood'),
    lookPreset: controls.lookPreset ?? preferred(profile, 'style'),
  };
}
