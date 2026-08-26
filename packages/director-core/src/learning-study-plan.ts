import type { LearningDomain } from './jhadina-learning-events';

export type StudyInput = {
  id: string;
  url: string;
  title?: string;
  domain?: LearningDomain;
  autonomous: boolean;
  shareWithJhadina: boolean;
  maxNotesPerMinute?: number;
};

export type StudyCheckpoint = {
  studyId: string;
  timeSeconds: number;
  observationsSeen: number;
  notesCreated: number;
  learningCandidatesCreated: number;
};

export function createStudyInput(input: Omit<StudyInput, 'autonomous' | 'shareWithJhadina'> & Partial<Pick<StudyInput, 'autonomous' | 'shareWithJhadina'>>): StudyInput {
  return {
    ...input,
    autonomous: input.autonomous ?? true,
    shareWithJhadina: input.shareWithJhadina ?? true,
  };
}

export function shouldCreateStudyNote(lastNoteAt: number | undefined, nowSeconds: number, maxNotesPerMinute = 6): boolean {
  if (lastNoteAt === undefined) return true;
  const minimumGap = 60 / Math.max(1, maxNotesPerMinute);
  return nowSeconds - lastNoteAt >= minimumGap;
}
