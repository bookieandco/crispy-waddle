import type { Observation } from './observation-bus.js';
import type { StudyJob } from './study-job.js';
import { runStudyJob, type StudyJobEffects, type StudyJobStore } from './study-job-runner.js';
import type { MediaDecoderAdapter, DecodeRequest } from './media-decoder-adapter.js';
import type { ObservationProvider } from './observation-provider-adapters.js';
import { createObservationProviderRegistry } from './observation-provider-adapters.js';

export type AutonomousStudyRuntime = {
  run(job: StudyJob): Promise<StudyJob | undefined>;
};

export function createAutonomousStudyRuntime(input: {
  store: StudyJobStore;
  decoder: MediaDecoderAdapter;
  providers: ObservationProvider[];
  publish: (observations: Observation[]) => Promise<void>;
  note?: (observation: Observation) => Promise<void>;
  learn?: (observation: Observation, job: StudyJob) => Promise<void>;
}): AutonomousStudyRuntime {
  const registry = createObservationProviderRegistry(input.providers);
  return {
    run(job) {
      const request: DecodeRequest = { source: job.sourceUrl, assetId: job.id, startSeconds: job.lastTimeSeconds };
      const effects: StudyJobEffects = {
        observe: () => mergeSamples(input.decoder.decodeFrames(request), input.decoder.decodeAudio(request), registry, input.publish),
        note: input.note,
        learn: input.learn,
      };
      return runStudyJob(job.id, input.store, effects);
    },
  };
}

async function* mergeSamples(frames: AsyncIterable<any>, audio: AsyncIterable<any>, registry: ReturnType<typeof createObservationProviderRegistry>, publish: (o: Observation[]) => Promise<void>): AsyncIterable<Observation> {
  for await (const frame of frames) {
    const observations = await registry.observeFrame(frame);
    if (observations.length) await publish(observations);
    yield* observations;
  }
  for await (const window of audio) {
    const observations = await registry.observeAudio(window);
    if (observations.length) await publish(observations);
    yield* observations;
  }
}
