import type { LearningDomain } from './jhadina-learning-events';

export type StudyJobStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed';

export type StudyJob = {
  id: string;
  sourceUrl: string;
  title?: string;
  domain: LearningDomain;
  autonomous: boolean;
  shareWithJhadina: boolean;
  status: StudyJobStatus;
  startedAt?: string;
  completedAt?: string;
  lastTimeSeconds: number;
  observationsSeen: number;
  notesCreated: number;
  learningCandidatesCreated: number;
  error?: string;
};

export function createStudyJob(input: Pick<StudyJob, 'id' | 'sourceUrl'> & Partial<Omit<StudyJob, 'id' | 'sourceUrl'>>): StudyJob {
  return {
    id: input.id,
    sourceUrl: input.sourceUrl,
    title: input.title,
    domain: input.domain ?? 'universal',
    autonomous: input.autonomous ?? true,
    shareWithJhadina: input.shareWithJhadina ?? true,
    status: input.status ?? 'queued',
    lastTimeSeconds: input.lastTimeSeconds ?? 0,
    observationsSeen: input.observationsSeen ?? 0,
    notesCreated: input.notesCreated ?? 0,
    learningCandidatesCreated: input.learningCandidatesCreated ?? 0,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    error: input.error,
  };
}

export function updateStudyJob(job: StudyJob, patch: Partial<StudyJob>): StudyJob {
  return { ...job, ...patch };
}
