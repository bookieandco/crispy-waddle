import type { DirectorTasteProfile, DirectorTasteSignal } from './director-taste.js';
import type { AttributeTasteSignal } from './director-taste-attribute.js';

const categoryFor = (attribute: string): DirectorTasteSignal['category'] => {
  switch (attribute) {
    case 'lightingMood': return 'mood';
    case 'lookPreset': return 'style';
    case 'framing':
    case 'cameraMovement':
    case 'lens':
    case 'cameraHeight':
    case 'cameraAngle':
    case 'depthOfField':
    case 'colorGrade':
    case 'performanceIntensity':
    case 'durationSec':
      return 'style';
    default: return 'style';
  }
};

export function mergeAttributeTasteIntoProfile(
  profile: DirectorTasteProfile,
  attributes: readonly AttributeTasteSignal[],
): DirectorTasteProfile {
  const existing = profile.signals ?? [];
  const incoming: DirectorTasteSignal[] = attributes.map((signal) => ({
    subject: signal.subject,
    category: categoryFor(signal.attribute),
    sentiment: signal.sentiment,
    confidence: signal.confidence,
    sourceExperienceIds: signal.sourceExperienceIds,
  }));

  return { ...profile, signals: [...existing, ...incoming] };
}
