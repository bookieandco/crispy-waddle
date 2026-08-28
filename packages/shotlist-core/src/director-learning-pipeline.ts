import type { DirectorTasteProfile } from './director-taste.js';
import { aggregateRecipeTaste, type RecipeTasteObservation } from './director-taste-aggregator.js';
import type { DirectorTakeFeedback } from './director-taste-feedback.js';
import type { DirectorTakeRecipe } from './director-feedback-recipe.js';

export interface ScopedDirectorObservation extends RecipeTasteObservation {
  ownerId: string;
  projectId: string;
}

export function buildDirectorTasteProfile(
  ownerId: string,
  projectId: string,
  observations: readonly ScopedDirectorObservation[],
): DirectorTasteProfile {
  const scoped = observations.filter((item) => item.ownerId === ownerId && item.projectId === projectId);
  return aggregateRecipeTaste(scoped);
}

export function feedbackToScopedObservations(
  feedback: DirectorTakeFeedback,
  recipe: DirectorTakeRecipe,
  ownerId: string,
  projectId: string,
): ScopedDirectorObservation[] {
  const sentiment = { love: 100, like: 60, neutral: 0, dislike: -60, hate: -100 }[feedback.reaction];
  const experienceId = `director:take:${feedback.takeId}:feedback`;
  return Object.entries(recipe.controls)
    .filter(([, subject]) => subject !== undefined && subject !== null && subject !== '')
    .map(([attribute, subject]) => ({
      ownerId,
      projectId,
      attribute,
      subject: String(subject),
      sentiment,
      confidence: 40,
      experienceId,
    }));
}
