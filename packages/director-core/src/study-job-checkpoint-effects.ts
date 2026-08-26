import type { Observation } from './observation-bus.js';
import type { StudyJob } from './study-job.js';
import type { StudyCheckpointRunner } from './study-checkpoint-runner.js';

export type StudyCheckpointEffects = {
  onObservation(job: StudyJob, observation: Observation): Promise<StudyJob>;
  onFinal(job: StudyJob): Promise<void>;
};

export function createStudyCheckpointEffects(checkpoints: StudyCheckpointRunner): StudyCheckpointEffects {
  return {
    async onObservation(job) {
      await checkpoints.observe(job);
      return job;
    },
    async onFinal(job) {
      await checkpoints.final(job);
    },
  };
}
