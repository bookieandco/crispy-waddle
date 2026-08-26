import type { StudyJob } from '@jhadina/director-core/study-job';
import type { StudyRuntimeLauncher } from '@jhadina/director-core/study-control-orchestrator';

export type AutonomousStudyRuntime = {
  run(job: StudyJob, signal: AbortSignal): Promise<void>;
};

export function createDirectorStudyRuntimeLauncher(runtime: AutonomousStudyRuntime): StudyRuntimeLauncher {
  return {
    async launch(job, signal) {
      await runtime.run(job, signal);
    },
  };
}
