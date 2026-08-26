import type { Observation, ObservationSubscriber } from './observation-bus';

export type ViewerFrame = {
  timestampSeconds: number;
  payload: unknown;
};

export type ViewerAudioWindow = {
  startSeconds: number;
  endSeconds: number;
  payload: unknown;
};

export type ViewerWorker = {
  start(): Promise<void>;
  stop(): Promise<void>;
};

export type ViewerWorkerDeps = {
  frames?: AsyncIterable<ViewerFrame>;
  audio?: AsyncIterable<ViewerAudioWindow>;
  analyzeFrame?: (frame: ViewerFrame) => Promise<Observation[]>;
  analyzeAudio?: (window: ViewerAudioWindow) => Promise<Observation[]>;
  publish: (observations: Observation[]) => Promise<void>;
};

export function createAutonomousViewerWorker(deps: ViewerWorkerDeps): ViewerWorker {
  let stopped = false;

  return {
    async start() {
      stopped = false;
      const tasks: Promise<void>[] = [];

      if (deps.frames && deps.analyzeFrame) {
        tasks.push((async () => {
          for await (const frame of deps.frames!) {
            if (stopped) break;
            const observations = await deps.analyzeFrame!(frame);
            if (observations.length) await deps.publish(observations);
          }
        })());
      }

      if (deps.audio && deps.analyzeAudio) {
        tasks.push((async () => {
          for await (const window of deps.audio!) {
            if (stopped) break;
            const observations = await deps.analyzeAudio!(window);
            if (observations.length) await deps.publish(observations);
          }
        })());
      }

      await Promise.all(tasks);
    },
    async stop() {
      stopped = true;
    },
  };
}
