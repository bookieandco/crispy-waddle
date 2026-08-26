import type { StudyJob, StudyJobStatus } from '@jhadina/director-core/study-job';
import type { StudyControlAction } from './study-control';

export type StudyJobControlStore = {
  get(id: string): Promise<StudyJob | undefined>;
  save(job: StudyJob): Promise<void>;
};

export type StudyControlTransition = {
  status: StudyJobStatus;
  startedAt?: string;
  completedAt?: string;
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
  const transition = getStudyControlTransition(job, action);
  if (!transition) return job;
  const next: StudyJob = { ...job, ...transition };
  await store.save(next);
  return next;
}

export function getStudyControlTransition(job: StudyJob, action: StudyControlAction): StudyControlTransition | undefined {
  if (action === 'promote-learning') return undefined;
  const status = transitions[action];
  if (!status) return undefined;
  const now = new Date().toISOString();
  return {
    status,
    startedAt: action === 'start' && !job.startedAt ? now : job.startedAt,
    completedAt: action === 'stop' ? now : job.completedAt,
  };
}
