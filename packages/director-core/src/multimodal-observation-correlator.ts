import type { Observation } from './observation-bus.js';

export type ObservationCluster = {
  startSeconds: number;
  endSeconds: number;
  observations: Observation[];
};

export function correlateObservations(observations: Observation[], toleranceSeconds = 1): ObservationCluster[] {
  const sorted = [...observations].sort((a, b) => a.time.startSeconds - b.time.startSeconds);
  const clusters: ObservationCluster[] = [];
  for (const observation of sorted) {
    const current = clusters.at(-1);
    if (!current || observation.time.startSeconds > current.endSeconds + toleranceSeconds) {
      clusters.push({ startSeconds: observation.time.startSeconds, endSeconds: observation.time.endSeconds, observations: [observation] });
      continue;
    }
    current.endSeconds = Math.max(current.endSeconds, observation.time.endSeconds);
    current.observations.push(observation);
  }
  return clusters;
}
