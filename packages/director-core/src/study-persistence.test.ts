import { describe, expect, it } from 'vitest';
import { createTestStudyPersistence } from './study-persistence-memory.js';
import { resumeFromLatestCheckpoint } from './study-checkpoint-store.js';
import type { StudyJob } from './study-job.js';

describe('study persistence lifecycle', () => {
  it('restores the newest checkpoint into a paused study', async () => {
    const persistence = createTestStudyPersistence();
    const job: StudyJob = {
      id: 'study-1', sourceUrl: 'sample.mp4', autonomous: true, shareWithJhadina: true,
      status: 'paused', lastTimeSeconds: 10, observationsSeen: 2, notesCreated: 1,
      learningCandidatesCreated: 1,
    };
    await persistence.jobs.save(job);
    await persistence.checkpoints.save({ id: 'cp-1', studyId: 'study-1', timeSeconds: 30, observationsSeen: 8, notesCreated: 4, learningCandidatesCreated: 2, createdAt: '2026-08-26T00:00:00.000Z' });
    await persistence.checkpoints.save({ id: 'cp-2', studyId: 'study-1', timeSeconds: 20, observationsSeen: 5, notesCreated: 3, learningCandidatesCreated: 1, createdAt: '2026-08-25T23:00:00.000Z' });

    const resumed = await resumeFromLatestCheckpoint(job, persistence.checkpoints);
    expect(resumed.status).toBe('running');
    expect(resumed.lastTimeSeconds).toBe(30);
    expect(resumed.observationsSeen).toBe(8);
    expect(resumed.notesCreated).toBe(4);
    expect(resumed.learningCandidatesCreated).toBe(2);
  });
});
