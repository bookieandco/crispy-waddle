import type { StudyJob } from './study-job.js';
import { resumeFromLatestCheckpoint, type StudyCheckpointStore } from './study-checkpoint-store.js';

export async function prepareStudyResume(job: StudyJob, store: StudyCheckpointStore): Promise<StudyJob> {
  if (job.status !== 'paused') return job;
  return resumeFromLatestCheckpoint(job, store);
}
