import type { StudyJob } from './study-job.js';
import type { StudyCheckpoint } from './study-resume-state.js';
import type { StudyCheckpointPolicy } from './study-checkpoint-policy.js';

export type StudyCheckpointStore = {
  save(checkpoint: StudyCheckpoint): Promise<void>;
};

export type StudyCheckpointRunner = {
  observe(job: StudyJob): Promise<StudyCheckpoint | undefined>;
  final(job: StudyJob): Promise<StudyCheckpoint>;
};

export function createStudyCheckpointRunner(policy: StudyCheckpointPolicy, store: StudyCheckpointStore): StudyCheckpointRunner {
  let previousSeconds = 0;
  return {
    async observe(job) {
      const current = job.lastTimeSeconds;
      if (!policy.shouldCheckpoint(previousSeconds, current)) return undefined;
      previousSeconds = current;
      const checkpoint = policy.checkpoint(job);
      await store.save(checkpoint);
      return checkpoint;
    },
    async final(job) {
      const checkpoint = policy.checkpoint(job);
      previousSeconds = job.lastTimeSeconds;
      await store.save(checkpoint);
      return checkpoint;
    },
  };
}
