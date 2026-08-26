import { describe, expect, it } from 'vitest';
import { runStudyJob } from './study-job-runner.js';
import type { Observation } from './observation-bus.js';
import type { StudyCheckpoint } from './study-resume-state.js';
import type { StudyJob } from './study-job.js';

const baseJob: StudyJob = { id: 'study-1', sourceUrl: 'sample.mp4', autonomous: true, shareWithJhadina: false, status: 'queued', lastTimeSeconds: 0, observationsSeen: 0, notesCreated: 0, learningCandidatesCreated: 0 };
const observation = (endSeconds: number): Observation => ({ id: `o-${endSeconds}`, assetId: 'asset-1', kind: 'visual', time: { startSeconds: endSeconds - 1, endSeconds }, payload: { label: 'scene' }, confidence: 1, provenance: { provider: 'test', source: 'synthetic' } });

describe('runStudyJob checkpoint integration', () => {
  it('calls periodic and final checkpoint hooks as the job advances', async () => {
    let job = baseJob;
    const saved: StudyCheckpoint[] = [];
    const store = { get: async () => job, save: async (next: StudyJob) => { job = next; } };
    const checkpoints = { observe: async (next: StudyJob) => { if (next.lastTimeSeconds >= 30) saved.push({ studyId: next.id, timeSeconds: next.lastTimeSeconds, observationsSeen: next.observationsSeen, notesCreated: next.notesCreated, learningCandidatesCreated: next.learningCandidatesCreated, capturedAt: 'test' }); }, final: async (next: StudyJob) => { saved.push({ studyId: next.id, timeSeconds: next.lastTimeSeconds, observationsSeen: next.observationsSeen, notesCreated: next.notesCreated, learningCandidatesCreated: next.learningCandidatesCreated, capturedAt: 'test' }); } };
    async function* source() { yield observation(30); yield observation(60); }
    await runStudyJob('study-1', store, { observe: () => source(), checkpoints });
    expect(saved.map(x => x.timeSeconds)).toEqual([30, 60, 60]);
  });
});
