import type { StudyCheckpoint } from './study-resume-state.js';
import type { StudyJob } from './study-job.js';

export interface StudyJobRepository {
  get(id: string): Promise<StudyJob | undefined>;
  save(job: StudyJob): Promise<void>;
}

export interface StudyCheckpointRepository {
  save(checkpoint: StudyCheckpoint): Promise<void>;
  latest(studyId: string): Promise<StudyCheckpoint | undefined>;
}

export type StudyPersistence = {
  jobs: StudyJobRepository;
  checkpoints: StudyCheckpointRepository;
};

export function createStudyPersistence(
  jobs: StudyJobRepository,
  checkpoints: StudyCheckpointRepository,
): StudyPersistence {
  return { jobs, checkpoints };
}
