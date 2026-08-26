import { describe, expect, it } from 'vitest';
import { createAutonomousStudyRuntime } from './autonomous-study-runtime.js';
import { createStudyJob, type StudyJob } from './study-job.js';
import type { Observation } from './observation-bus.js';

const observation = (id: string, seconds: number): Observation => ({
  id,
  assetId: 'asset-1',
  kind: 'speech',
  time: { startSeconds: seconds, endSeconds: seconds + 1 },
  payload: { text: `observation-${id}` },
  confidence: 0.9,
  provenance: { provider: 'test', source: 'synthetic' },
});

describe('AutonomousStudyRuntime', () => {
  it('connects decoded media to observations, notes, and learning', async () => {
    const jobs = new Map<string, StudyJob>();
    const notes: Observation[] = [];
    const learned: Observation[] = [];
    const published: Observation[] = [];
    const job = createStudyJob({ id: 'study-1', sourceUrl: 'file:///sample.mp4' });
    jobs.set(job.id, job);

    const decoder = {
      async *decodeFrames() { yield { assetId: job.id, timestampSeconds: 1, frameRef: 'frame-1' }; },
      async *decodeAudio() { yield { assetId: job.id, startSeconds: 1, endSeconds: 3, audioRef: 'audio-1' }; },
    };
    const providers = [{
      name: 'test',
      async observeFrame() { return [observation('frame', 1)]; },
      async observeAudio() { return [observation('audio', 2)]; },
    }];

    const runtime = createAutonomousStudyRuntime({
      store: { async get(id) { return jobs.get(id); }, async save(next) { jobs.set(next.id, next); } },
      decoder,
      providers,
      publish: async values => { published.push(...values); },
      note: async value => { notes.push(value); },
      learn: async value => { learned.push(value); },
    });

    const result = await runtime.run(job);
    expect(result?.status).toBe('completed');
    expect(result?.observationsSeen).toBe(2);
    expect(result?.notesCreated).toBe(2);
    expect(result?.learningCandidatesCreated).toBe(2);
    expect(published).toHaveLength(2);
    expect(notes).toHaveLength(2);
    expect(learned).toHaveLength(2);
  });
});
