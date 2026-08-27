import type { ExperienceEvent } from '../../jhadina-core-spine/src/experience.js';
import type { ScopedDirectorObservation } from './director-learning-pipeline.js';
import { aggregateRecipeTaste } from './director-taste-aggregator.js';
import type { DirectorTasteProfile } from './director-taste.js';

export interface DirectorFeedbackMetadata {
  takeId: string;
  shotId: string;
  reaction: 'love' | 'like' | 'neutral' | 'dislike' | 'hate';
  controls: Record<string, unknown>;
}

export function experienceToDirectorObservation(
  event: ExperienceEvent,
): ScopedDirectorObservation[] {
  if (event.eventType !== 'director.take.feedback') return [];
  const metadata = event.metadata as Partial<DirectorFeedbackMetadata> | undefined;
  if (!metadata?.takeId || !metadata.controls) return [];

  const sentiment = { love: 100, like: 60, neutral: 0, dislike: -60, hate: -100 }[metadata.reaction ?? 'neutral'];
  return Object.entries(metadata.controls)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([attribute, value]) => ({
      ownerId: event.scope.ownerId,
      projectId: String(event.metadata?.projectId ?? 'default'),
      attribute,
      subject: String(value),
      sentiment,
      confidence: 40,
      experienceId: event.id,
    }));
}

export function tasteProfileFromExperienceEvents(
  ownerId: string,
  projectId: string,
  events: readonly ExperienceEvent[],
): DirectorTasteProfile {
  const observations = events.flatMap(experienceToDirectorObservation)
    .filter((observation) => observation.ownerId === ownerId && observation.projectId === projectId);
  return aggregateRecipeTaste(observations);
}
