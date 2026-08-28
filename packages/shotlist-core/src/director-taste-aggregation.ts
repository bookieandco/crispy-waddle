import type { DirectorControls } from './types.js';
import type { DirectorTakeFeedback } from './director-taste-feedback.js';

export interface DirectorAttributeObservation {
  attribute: keyof DirectorControls;
  value: string;
  sentiment: number;
  experienceId: string;
}

export interface DirectorAttributePreference {
  attribute: keyof DirectorControls;
  value: string;
  sentiment: number;
  confidence: number;
  evidenceIds: string[];
}

const sentimentFor = (reaction: DirectorTakeFeedback['reaction']) => ({ love: 100, like: 60, neutral: 0, dislike: -60, hate: -100 }[reaction]);

export function observationsFromTakeFeedback(
  feedback: DirectorTakeFeedback,
  controls: DirectorControls,
): DirectorAttributeObservation[] {
  const experienceId = `director:take:${feedback.takeId}:feedback`;
  return (Object.entries(controls) as [keyof DirectorControls, string | number | undefined][])
    .filter((entry): entry is [keyof DirectorControls, string] => typeof entry[1] === 'string' && entry[1].length > 0)
    .map(([attribute, value]) => ({ attribute, value, sentiment: sentimentFor(feedback.reaction), experienceId }));
}

export function aggregateDirectorPreferences(observations: readonly DirectorAttributeObservation[]): DirectorAttributePreference[] {
  const groups = new Map<string, DirectorAttributeObservation[]>();
  for (const observation of observations) {
    const key = `${String(observation.attribute)}:${observation.value}`;
    const group = groups.get(key) ?? [];
    group.push(observation);
    groups.set(key, group);
  }

  return [...groups.values()].map((group) => {
    const evidenceIds = [...new Set(group.map((item) => item.experienceId))];
    return {
      attribute: group[0].attribute,
      value: group[0].value,
      sentiment: Math.round(group.reduce((sum, item) => sum + item.sentiment, 0) / group.length),
      confidence: Math.min(100, 30 + evidenceIds.length * 12),
      evidenceIds,
    };
  });
}
