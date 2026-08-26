import { createStudyControlOrchestrator, type StudyRuntimeLauncher } from '@jhadina/director-core/study-control-orchestrator';
import { createStudyCancellationRegistry } from '@jhadina/director-core/study-cancellation-registry';
import type { StudyCheckpointStore } from '@jhadina/director-core/study-checkpoint-store';
import type { StudyJobControlStore } from './study-control-server';

export function createWebStudyControlOrchestrator(
  store: StudyJobControlStore,
  checkpoints: StudyCheckpointStore,
  launcher: StudyRuntimeLauncher,
) {
  return createStudyControlOrchestrator(
    checkpoints,
    createStudyCancellationRegistry(),
    launcher,
    job => store.save(job),
  );
}
