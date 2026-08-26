import type { StudyJob } from './study-job.js';
import type { StudyCheckpointStore } from './study-checkpoint-store.js';
import { prepareStudyResume } from './study-resume-controller.js';
import type { StudyCancellationRegistry } from './study-cancellation-registry.js';

export type StudyRuntimeLauncher = {
  launch(job: StudyJob, signal: AbortSignal): Promise<void>;
};

export type StudyControlOrchestrator = {
  pause(job: StudyJob): Promise<StudyJob>;
  stop(job: StudyJob): Promise<StudyJob>;
  resume(job: StudyJob): Promise<StudyJob>;
};

export function createStudyControlOrchestrator(
  checkpoints: StudyCheckpointStore,
  cancellation: StudyCancellationRegistry,
  launcher: StudyRuntimeLauncher,
  save: (job: StudyJob) => Promise<void>,
): StudyControlOrchestrator {
  return {
    async pause(job) {
      cancellation.cancel(job.id);
      const next = { ...job, status: 'paused' as const };
      await save(next);
      return next;
    },
    async stop(job) {
      cancellation.cancel(job.id);
      const next = { ...job, status: 'completed' as const, completedAt: new Date().toISOString() };
      await save(next);
      return next;
    },
    async resume(job) {
      const next = await prepareStudyResume(job, checkpoints);
      await save(next);
      const signal = cancellation.signalFor(next.id);
      void launcher.launch(next, signal).catch(async error => {
        await save({ ...next, status: 'failed' as const, error: error instanceof Error ? error.message : String(error) });
      });
      return next;
    },
  };
}
