import type { DirectorTakeFeedback } from './director-taste-feedback.js';
import type { DirectorControls } from './types.js';
import type { DirectorTasteSignal } from './director-taste.js';

export interface DirectorTakeRecipe {
  controls: DirectorControls;
  storyIntent?: string;
  prompt?: string;
}

const sentiment: Record<DirectorTakeFeedback['reaction'], number> = {
  love: 100, like: 60, neutral: 0, dislike: -60, hate: -100,
};

export function feedbackToRecipeTasteSignals(
  feedback: DirectorTakeFeedback,
  recipe: DirectorTakeRecipe,
): DirectorTasteSignal[] {
  const value = sentiment[feedback.reaction];
  const sourceExperienceId = `director:take:${feedback.takeId}:feedback`;
  return Object.entries(recipe.controls).flatMap(([attribute, selected]) => {
    if (selected === undefined || selected === null || selected === '') return [];
    return [{
      subject: String(selected),
      category: 'style' as const,
      sentiment: value,
      confidence: 40,
      sourceExperienceIds: [sourceExperienceId],
      attribute,
    } as DirectorTasteSignal & { attribute: string }];
  });
}
