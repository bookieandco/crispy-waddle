import type { Observation } from './observation-bus.js';
import type { MediaSample } from './streaming-media-source.js';

export type StreamingMediaWorker = {
  process(samples: AsyncIterable<MediaSample>): Promise<void>;
};

export function createStreamingMediaWorker(input: {
  publish: (observations: Observation[]) => Promise<void>;
  analyze: (sample: MediaSample) => Promise<Observation[]>;
  signal?: AbortSignal;
}): StreamingMediaWorker {
  return {
    async process(samples) {
      for await (const sample of samples) {
        if (input.signal?.aborted) break;
        const observations = await input.analyze(sample);
        if (observations.length) await input.publish(observations);
      }
    },
  };
}
