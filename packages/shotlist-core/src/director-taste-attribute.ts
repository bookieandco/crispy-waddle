import type { DirectorTakeFeedback } from './director-taste-feedback.js';
import type { DirectorControls } from './types.js';

export type DirectorTasteAttribute = keyof DirectorControls;

export interface AttributeTasteSignal {
  attribute: DirectorTasteAttribute;
  subject: string;
  sentiment: number;
  confidence: number;
  sourceExperienceIds: string[];
}

const sentiment: Record<DirectorTakeFeedback['reaction'], number> = {
  love: 100, like: 60, neutral: 0, dislike: -60, hate: -100,
};

export function feedbackToAttributeTasteSignals(
  feedback: DirectorTakeFeedback,
  controls: DirectorControls,
): AttributeTasteSignal[] {
  const value = sentiment[feedback.reaction];
  const sourceExperienceIds = [`director:take:${feedback.takeId}:feedback`];
  return (Object.entries(controls) as [DirectorTasteAttribute, unknown][])
    .filter(([, subject]) => subject !== undefined && subject !== null && subject !== '')
    .map(([attribute, subject]) => ({
      attribute,
      subject: String(subject),
      sentiment: value,
      confidence: 40,
      sourceExperienceIds,
    }));
}
