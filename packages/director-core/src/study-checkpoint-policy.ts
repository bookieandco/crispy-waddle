import type { StudyJob } from './study-job.js';
import { checkpointFromStudyJob, type StudyCheckpoint } from './study-resume-state.js';

export type StudyCheckpointPolicy = {
  intervalSeconds: number;
  shouldCheckpoint(previousSeconds: number, currentSeconds: number): boolean;
  checkpoint(job: StudyJob): StudyCheckpoint;
};

export function createStudyCheckpointPolicy(intervalSeconds = 30): StudyCheckpointPolicy {
  const interval = Math.max(1, intervalSeconds);
  return {
    intervalSeconds: interval,
    shouldCheckpoint(previousSeconds, currentSeconds) {
      return currentSeconds >= previousSeconds + interval;
    },
    checkpoint(job) {
      return checkpointFromStudyJob(job);
    },
  };
}
