import type { StudyJob } from './study-job.js';

export type StudyCheckpoint = {
  studyId: string;
  timeSeconds: number;
  observationsSeen: number;
  notesCreated: number;
  learningCandidatesCreated: number;
  capturedAt: string;
};

export function checkpointFromStudyJob(job: StudyJob): StudyCheckpoint {
  return {
    studyId: job.id,
    timeSeconds: job.lastTimeSeconds,
    observationsSeen: job.observationsSeen,
    notesCreated: job.notesCreated,
    learningCandidatesCreated: job.learningCandidatesCreated,
    capturedAt: new Date().toISOString(),
  };
}

export function resumeStudyJob(job: StudyJob, checkpoint: StudyCheckpoint): StudyJob {
  if (checkpoint.studyId !== job.id) throw new Error('checkpoint belongs to a different study');
  return {
    ...job,
    status: 'running',
    lastTimeSeconds: checkpoint.timeSeconds,
    observationsSeen: checkpoint.observationsSeen,
    notesCreated: checkpoint.notesCreated,
    learningCandidatesCreated: checkpoint.learningCandidatesCreated,
    completedAt: undefined,
    error: undefined,
  };
}
