import type { StudyCheckpoint } from './study-resume-state.js';
import type { StudyJob } from './study-job.js';
import type { StudyPersistence } from './study-persistence.js';

export function createTestStudyPersistence(): StudyPersistence {
  const jobs = new Map<string, StudyJob>();
  const checkpoints = new Map<string, StudyCheckpoint>();
  return {
    jobs: {
      async get(id) { return jobs.get(id); },
      async save(job) { jobs.set(job.id, job); },
    },
    checkpoints: {
      async save(checkpoint) {
        const current = checkpoints.get(checkpoint.studyId);
        if (!current || checkpoint.timeSeconds >= current.timeSeconds) checkpoints.set(checkpoint.studyId, checkpoint);
      },
      async latest(studyId) { return checkpoints.get(studyId); },
    },
  };
}
