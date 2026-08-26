import type { StudyJob, StudyJobStatus } from '@jhadina/director-core/study-job';
import type { StudyControlAction } from './study-control';

export type StudyJobControlStore = {
  get(id: string): Promise<StudyJob | undefined>;
  save(job: StudyJob): Promise<void>;
};

const transitions: Partial<Record<StudyControlAction, StudyJobStatus>> = {
  start: 'running',
  pause: 'paused',
  resume: 'running',
  stop: 'completed',
};

export async function controlStudyJob(store: StudyJobControlStore, id: string, action: StudyControlAction): Promise<StudyJob | undefined> {
  const job = await store.get(id);
  if (!job) return undefined;

  if (action === 'promote-learning') return job;
  const status = transitions[action];
  if (!status) return job;

  const now = new Date().toISOString();
  const next: StudyJob = {
    ...job,
    status,
    startedAt: action === 'start' && !job.startedAt ? now : job.startedAt,
    completedAt: action === 'stop' ? now : job.completedAt,
  };
  await store.save(next);
  return next;
}
