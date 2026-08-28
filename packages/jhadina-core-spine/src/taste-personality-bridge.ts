import type { TasteProfile, TasteSignal } from './taste-aggregator.js';

export interface PersonalityCandidate {
  trait: string;
  value: number;
  confidence: number;
  evidenceIds: string[];
  status: 'candidate';
  reason: string;
}

const traitFor = (signal: TasteSignal): string | undefined => {
  if (signal.category === 'genre') return `taste.genre.${signal.subject}`;
  if (signal.category === 'creator') return `taste.creator.${signal.subject}`;
  if (signal.category === 'style') return `taste.style.${signal.subject}`;
  return undefined;
};

export function tasteToPersonalityCandidates(profile: TasteProfile): PersonalityCandidate[] {
  return profile.signals.flatMap((signal) => {
    const trait = traitFor(signal);
    if (!trait || signal.confidence < 50) return [];
    return [{
      trait,
      value: signal.sentiment,
      confidence: signal.confidence,
      evidenceIds: signal.sourceExperienceIds,
      status: 'candidate' as const,
      reason: `Repeated ${signal.category} preference supported by ${signal.sourceExperienceIds.length} experience(s).`,
    }];
  });
}
