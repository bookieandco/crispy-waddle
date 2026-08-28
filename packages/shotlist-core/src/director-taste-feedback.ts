import type { DirectorTasteProfile } from './director-taste.js';

export interface DirectorTakeFeedback {
  takeId: string;
  shotId: string;
  reaction: 'love' | 'like' | 'neutral' | 'dislike' | 'hate';
  notes?: string;
  observedAt: string;
}

const sentiment: Record<DirectorTakeFeedback['reaction'], number> = {
  love: 100, like: 60, neutral: 0, dislike: -60, hate: -100,
};

export interface DirectorTasteEvidence {
  takeId: string;
  sentiment: number;
  notes?: string;
  observedAt: string;
}

export function recordDirectorTakeFeedback(
  feedback: DirectorTakeFeedback,
  existing: DirectorTasteProfile,
): DirectorTasteProfile {
  const evidence: DirectorTasteEvidence = {
    takeId: feedback.takeId,
    sentiment: sentiment[feedback.reaction],
    notes: feedback.notes,
    observedAt: feedback.observedAt,
  };
  return {
    ...existing,
    version: 1,
    evidence: [...(existing.evidence ?? []), evidence],
  } as DirectorTasteProfile;
}
