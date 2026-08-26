import type { Observation } from './observation-bus.js';
import type { StudyJob, StudyJobStatus } from './study-job.js';
import type { StudyCheckpointRunner } from './study-checkpoint-runner.js';

export type StudyObservationSource = (job: StudyJob) => AsyncIterable<Observation>;
export type StudyJobStore = {
  get(id: string): Promise<StudyJob | undefined>;
  save(job: StudyJob): Promise<void>;
};

export type StudyJobEffects = {
  observe(job: StudyJob): StudyObservationSource;
  note?(observation: Observation): Promise<void>;
  learn?(observation: Observation, job: StudyJob): Promise<void>;
  checkpoints?: StudyCheckpointRunner;
};

export async function runStudyJob(id: string, store: StudyJobStore, effects: StudyJobEffects): Promise<StudyJob | undefined> {
  const current = await store.get(id);
  if (!current || !current.autonomous) return current;

  let job: StudyJob = { ...current, status: 'running', startedAt: current.startedAt ?? new Date().toISOString() };
  await store.save(job);

  try {
    for await (const observation of effects.observe(job)) {
      if (observation.time.endSeconds <= job.lastTimeSeconds) continue;
      job = { ...job, lastTimeSeconds: Math.max(job.lastTimeSeconds, observation.time.endSeconds), observationsSeen: job.observationsSeen + 1 };
      if (effects.note) { await effects.note(observation); job = { ...job, notesCreated: job.notesCreated + 1 }; }
      if (job.shareWithJhadina && effects.learn) { await effects.learn(observation, job); job = { ...job, learningCandidatesCreated: job.learningCandidatesCreated + 1 }; }
      await store.save(job);
      if (effects.checkpoints) await effects.checkpoints.observe(job);
    }
    job = { ...job, status: 'completed', completedAt: new Date().toISOString() };
  } catch (error) {
    job = { ...job, status: 'failed', error: error instanceof Error ? error.message : String(error) };
  }
  await store.save(job);
  if (effects.checkpoints) await effects.checkpoints.final(job);
  return job;
}

export function pauseStudyJob(job: StudyJob): StudyJob { return { ...job, status: 'paused' as StudyJobStatus }; }
export function resumeStudyJob(job: StudyJob): StudyJob { return { ...job, status: 'queued' as StudyJobStatus, error: undefined }; }
