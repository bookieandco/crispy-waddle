import type { DirectorTasteProfile } from './director-taste.js';
import type { DirectorTakeFeedback } from './director-taste-feedback.js';
import { recordDirectorTakeFeedback } from './director-taste-feedback.js';

export function applyDirectorTakeFeedback(
  feedback: DirectorTakeFeedback,
  profile: DirectorTasteProfile,
): DirectorTasteProfile {
  return recordDirectorTakeFeedback(feedback, profile);
}

export function feedbackToTasteSignal(feedback: DirectorTakeFeedback) {
  const sentiment = { love: 100, like: 60, neutral: 0, dislike: -60, hate: -100 }[feedback.reaction];
  return {
    subject: feedback.shotId,
    category: 'style' as const,
    sentiment,
    confidence: 40,
    sourceExperienceIds: [`director:take:${feedback.takeId}:feedback`],
  };
}
