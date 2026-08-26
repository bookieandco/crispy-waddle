import type { StudyCheckpoint } from './study-resume-state.js';
import type { StudyJob } from './study-job.js';

export type StudyCheckpointStore = {
  save(checkpoint: StudyCheckpoint): Promise<void>;
  latest(studyId: string): Promise<StudyCheckpoint | undefined>;
};

export function createInMemoryStudyCheckpointStore(): StudyCheckpointStore {
  const checkpoints = new Map<string, StudyCheckpoint>();
  return {
    async save(checkpoint) {
      const existing = checkpoints.get(checkpoint.studyId);
      if (!existing || checkpoint.timeSeconds >= existing.timeSeconds) checkpoints.set(checkpoint.studyId, checkpoint);
    },
    async latest(studyId) {
      return checkpoints.get(studyId);
    },
  };
}

export async function resumeFromLatestCheckpoint(job: StudyJob, store: StudyCheckpointStore): Promise<StudyJob> {
  const checkpoint = await store.latest(job.id);
  if (!checkpoint) return job;
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
