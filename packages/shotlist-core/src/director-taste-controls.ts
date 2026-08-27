import type { DirectorTasteProfile } from './director-taste.js';
import type { DirectorControls } from './types.js';

function preferred(profile: DirectorTasteProfile, attribute: string, category: string, fallback?: string): string | undefined {
  const matches = (profile.signals ?? []).filter((s) => {
    const signalAttribute = (s as DirectorTasteSignalWithAttribute).attribute;
    return (signalAttribute ? signalAttribute === attribute : category === s.category)
      && s.confidence >= 50
      && s.sentiment > 0;
  });
  matches.sort((a, b) => b.sentiment * b.confidence - a.sentiment * a.confidence);
  return matches[0]?.subject ?? fallback;
}

interface DirectorTasteSignalWithAttribute {
  attribute?: string;
}

export function applyDirectorTasteToControls(
  controls: DirectorControls,
  profile: DirectorTasteProfile,
): DirectorControls {
  return {
    ...controls,
    framing: controls.framing ?? preferred(profile, 'framing', 'style'),
    cameraMovement: controls.cameraMovement ?? preferred(profile, 'cameraMovement', 'style'),
    lightingMood: controls.lightingMood ?? preferred(profile, 'lightingMood', 'mood'),
    lookPreset: controls.lookPreset ?? preferred(profile, 'lookPreset', 'style'),
  };
}
