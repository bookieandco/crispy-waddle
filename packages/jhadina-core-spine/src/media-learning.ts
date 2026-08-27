import type { ExperiencePort } from './experience.js';
import { mediaToExperience, proposeMediaLearning, type MediaExperience, type MediaLearningProposal } from './media-experience.js';

export interface MediaLearningResult {
  persisted: Awaited<ReturnType<ExperiencePort['append']>>;
  proposal: MediaLearningProposal;
}

export async function recordMediaExperience(
  media: MediaExperience,
  experiences: ExperiencePort,
  scope: { type: 'user'; ownerId: string },
): Promise<MediaLearningResult> {
  const event = {
    ...mediaToExperience(media),
    schemaVersion: 1 as const,
    eventType: 'media.observed' as const,
    recordedAt: new Date().toISOString(),
    outcome: 'observed' as const,
    sensitivity: 'private' as const,
    provenance: { sourceId: media.id, sourceType: 'media-observation' },
    scope,
  };

  const persisted = await experiences.append(event);
  return { persisted, proposal: proposeMediaLearning(media) };
}
