import type { Observation } from './observation-bus.js';
import type { StudyObservationSource } from './learning-study-runner.js';

export type MediaStudyWorker = {
  start(input: { sourceUrl: string; signal?: AbortSignal }): AsyncIterable<Observation>;
};

export type AutonomousMediaStudyAdapter = {
  study(sourceUrl: string, signal?: AbortSignal): StudyObservationSource;
};

export function createAutonomousMediaStudyAdapter(worker: MediaStudyWorker): AutonomousMediaStudyAdapter {
  return {
    study(sourceUrl, signal) {
      return {
        watch: () => worker.start({ sourceUrl, signal }),
      };
    },
  };
}
