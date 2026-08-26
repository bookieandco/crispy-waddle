import type { Observation } from './observation-bus.js';
import type { StudyJob } from './study-job.js';
import { runStudyJob, type StudyJobEffects, type StudyJobStore } from './study-job-runner.js';
import type { StudyCheckpointRunner } from './study-checkpoint-runner.js';
import type { MediaDecoderAdapter, DecodeRequest } from './media-decoder-adapter.js';
import type { ObservationProvider } from './observation-provider-adapters.js';
import { createObservationProviderRegistry } from './observation-provider-adapters.js';
import type { StudyCancellationRegistry } from './study-cancellation-registry.js';

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
  checkpoints?: StudyCheckpointRunner;
  cancellation?: StudyCancellationRegistry;
}): AutonomousStudyRuntime {
  const registry = createObservationProviderRegistry(input.providers);
  return {
    run(job) {
      const signal = input.cancellation?.signalFor(job.id);
      const request: DecodeRequest = { source: job.sourceUrl, assetId: job.id, startSeconds: job.lastTimeSeconds, signal };
      const effects: StudyJobEffects = {
        observe: () => mergeStreams(input.decoder.decodeFrames(request), input.decoder.decodeAudio(request), registry, input.publish),
        note: input.note,
        learn: input.learn,
        checkpoints: input.checkpoints,
      };
      const execution = runStudyJob(job.id, input.store, effects);
      return execution.finally(() => input.cancellation?.remove(job.id));
    },
  };
}

async function* mergeStreams(
  frames: AsyncIterable<Awaited<ReturnType<NonNullable<ObservationProvider['observeFrame']>>>>,
  audio: AsyncIterable<Awaited<ReturnType<NonNullable<ObservationProvider['observeAudio']>>>>,
  registry: ReturnType<typeof createObservationProviderRegistry>,
  publish: (observations: Observation[]) => Promise<void>,
): AsyncIterable<Observation> {
  const frameIterator = frames[Symbol.asyncIterator]();
  const audioIterator = audio[Symbol.asyncIterator]();
  let nextFrame = frameIterator.next();
  let nextAudio = audioIterator.next();
  let frameDone = false;
  let audioDone = false;

  while (!frameDone || !audioDone) {
    const pending: Array<Promise<{ stream: 'frame' | 'audio'; result: any }>> = [];
    if (!frameDone) pending.push(nextFrame.then(result => ({ stream: 'frame' as const, result })));
    if (!audioDone) pending.push(nextAudio.then(result => ({ stream: 'audio' as const, result })));
    const result = await Promise.race(pending);

    if (result.stream === 'frame') {
      if (result.result.done) {
        frameDone = true;
        continue;
      }
      const observations = await registry.observeFrame(result.result.value as any);
      if (observations.length) await publish(observations);
      yield* observations;
      nextFrame = frameIterator.next();
    } else {
      if (result.result.done) {
        audioDone = true;
        continue;
      }
      const observations = await registry.observeAudio(result.result.value as any);
      if (observations.length) await publish(observations);
      yield* observations;
      nextAudio = audioIterator.next();
    }
  }
}
