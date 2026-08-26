import type { AutonomousStudyRuntime } from './autonomous-study-runtime.js';
import type { StudyJob } from './study-job.js';
import type { StudyCheckpointRunner } from './study-checkpoint-runner.js';

export type CheckpointedAutonomousStudyRuntime = AutonomousStudyRuntime;

export function withStudyCheckpoints(runtime: AutonomousStudyRuntime, checkpoints: StudyCheckpointRunner): CheckpointedAutonomousStudyRuntime {
  return {
    async run(job: StudyJob) {
      const result = await runtime.run(job);
      if (result) await checkpoints.final(result);
      return result;
    },
  };
}
