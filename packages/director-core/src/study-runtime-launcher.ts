import type { AutonomousStudyRuntime } from './autonomous-study-runtime.js';
import type { StudyRuntimeLauncher } from './study-control-orchestrator.js';

/** Bridges the autonomous study runtime into the control-plane launcher contract. */
export function createStudyRuntimeLauncher(runtime: AutonomousStudyRuntime): StudyRuntimeLauncher {
  return {
    async launch(job, signal) {
      if (signal.aborted) return;
      await runtime.run(job);
    },
  };
}
