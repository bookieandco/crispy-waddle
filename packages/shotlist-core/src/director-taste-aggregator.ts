import type { DirectorTasteProfile, DirectorTasteSignal } from './director-taste.js';

export interface RecipeTasteObservation {
  subject: string;
  attribute: string;
  sentiment: number;
  confidence: number;
  experienceId: string;
}

export function aggregateRecipeTaste(
  observations: readonly RecipeTasteObservation[],
): DirectorTasteProfile {
  const groups = new Map<string, RecipeTasteObservation[]>();
  for (const observation of observations) {
    const key = `${observation.attribute}:${observation.subject}`;
    const group = groups.get(key) ?? [];
    group.push(observation);
    groups.set(key, group);
  }

  const signals: DirectorTasteSignal[] = [...groups.values()].map((group) => {
    const sentiment = Math.round(group.reduce((sum, item) => sum + item.sentiment, 0) / group.length);
    const confidence = Math.min(95, Math.round(40 + Math.min(55, (group.length - 1) * 15)));
    return {
      subject: group[0].subject,
      category: 'style',
      sentiment,
      confidence,
      sourceExperienceIds: [...new Set(group.map((item) => item.experienceId))],
    };
  });

  return { signals };
}
