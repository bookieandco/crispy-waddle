import { describe, expect, it } from 'vitest';
import { createStudyCheckpointPolicy } from './study-checkpoint-policy.js';
import { createStudyCheckpointRunner } from './study-checkpoint-runner.js';
import type { StudyCheckpoint } from './study-resume-state.js';
import type { StudyJob } from './study-job.js';

const job = (time: number): StudyJob => ({
  id: 'study-1', sourceUrl: 'sample.mp4', autonomous: true, shareWithJhadina: true,
  status: 'running', lastTimeSeconds: time, observationsSeen: Math.floor(time),
  notesCreated: Math.floor(time / 2), learningCandidatesCreated: Math.floor(time / 4),
});

describe('study checkpoint runner', () => {
  it('persists at the configured interval and always persists a final checkpoint', async () => {
    const saved: StudyCheckpoint[] = [];
    const runner = createStudyCheckpointRunner(createStudyCheckpointPolicy(30), { save: async checkpoint => saved.push(checkpoint) });

    await runner.observe(job(10));
    await runner.observe(job(29));
    await runner.observe(job(30));
    await runner.observe(job(59));
    await runner.observe(job(60));
    await runner.final(job(61));

    expect(saved.map(checkpoint => checkpoint.timeSeconds)).toEqual([30, 60, 61]);
  });
});
