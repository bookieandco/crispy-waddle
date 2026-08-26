import type { Observation } from './observation-bus.js';

export type VideoFrame = { assetId: string; timestampSeconds: number; frameRef?: string };
export type AudioWindow = { assetId: string; startSeconds: number; endSeconds: number; audioRef?: string };

export type VisionAnalyzer = (frame: VideoFrame) => Promise<Observation[]>;
export type AudioAnalyzer = (window: AudioWindow) => Promise<Observation[]>;
export type TranscriptAnalyzer = (window: AudioWindow) => Promise<Observation[]>;

export type MediaObservationWorker = {
  process(frames: AsyncIterable<VideoFrame>, audio: AsyncIterable<AudioWindow>): Promise<void>;
};

export function createMediaObservationWorker(input: {
  publish: (observations: Observation[]) => Promise<void>;
  vision?: VisionAnalyzer[];
  audio?: AudioAnalyzer[];
  transcript?: TranscriptAnalyzer[];
}): MediaObservationWorker {
  return {
    async process(frames, audio) {
      const audioWindows: AudioWindow[] = [];
      for await (const window of audio) audioWindows.push(window);
      for await (const frame of frames) {
        const observations = (await Promise.all((input.vision ?? []).map(analyzer => analyzer(frame)))).flat();
        if (observations.length) await input.publish(observations);
      }
      for (const window of audioWindows) {
        const observations = [
          ...(await Promise.all((input.audio ?? []).map(analyzer => analyzer(window)))).flat(),
          ...(await Promise.all((input.transcript ?? []).map(analyzer => analyzer(window)))).flat(),
        ];
        if (observations.length) await input.publish(observations);
      }
    },
  };
}
