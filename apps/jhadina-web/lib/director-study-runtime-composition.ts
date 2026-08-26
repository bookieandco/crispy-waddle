import type { StudyJob } from '@jhadina/director-core/study-job';
import type { StudyRuntimeLauncher } from '@jhadina/director-core/study-control-orchestrator';

/** Runtime boundary used by the web composition root. */
export type AutonomousStudyRuntime = {
  run(job: StudyJob): Promise<unknown>;
};

/** Adapt the concrete autonomous viewer runtime to the control-plane launcher. */
export function createDirectorStudyRuntimeLauncher(runtime: AutonomousStudyRuntime): StudyRuntimeLauncher {
  return {
    async launch(job) {
      await runtime.run(job);
    },
  };
}
