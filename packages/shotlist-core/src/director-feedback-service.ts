import type { ExperiencePort } from '../../jhadina-core-spine/src/experience.js';
import { createDirectorTakeFeedbackEvent } from './director-experience-events.js';
import type { DirectorTakeRecipe } from './director-feedback-recipe.js';

export interface DirectorFeedbackInput {
  eventId: string;
  ownerId: string;
  projectId: string;
  shotId: string;
  takeId: string;
  reaction: 'love' | 'like' | 'neutral' | 'dislike' | 'hate';
  occurredAt: string;
  recipe?: DirectorTakeRecipe;
}

export async function recordDirectorTakeFeedback(
  input: DirectorFeedbackInput,
  experiences: ExperiencePort,
): Promise<void> {
  await experiences.append(createDirectorTakeFeedbackEvent({
    eventId: input.eventId,
    ownerId: input.ownerId,
    projectId: input.projectId,
    shotId: input.shotId,
    takeId: input.takeId,
    reaction: input.reaction,
    occurredAt: input.occurredAt,
    controls: input.recipe?.controls as Record<string, string | number | boolean | null> | undefined,
  }));
}
