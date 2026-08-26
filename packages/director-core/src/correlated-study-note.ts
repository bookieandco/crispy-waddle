import type { Observation } from './observation-bus.js';
import type { ObservationCluster } from './multimodal-observation-correlator.js';

export type CorrelatedStudyNote = {
  startSeconds: number;
  endSeconds: number;
  observations: Observation[];
  summary: string;
  evidenceCount: number;
  confidence: number;
};

export function createCorrelatedStudyNote(cluster: ObservationCluster): CorrelatedStudyNote {
  const labels = cluster.observations.map(observation => {
    const payload = observation.payload as Record<string, unknown>;
    return typeof payload.text === 'string' ? payload.text : typeof payload.label === 'string' ? payload.label : observation.kind;
  });
  const confidence = cluster.observations.reduce((sum, observation) => sum + observation.confidence, 0) / Math.max(1, cluster.observations.length);
  return {
    startSeconds: cluster.startSeconds,
    endSeconds: cluster.endSeconds,
    observations: cluster.observations,
    summary: labels.join(' · '),
    evidenceCount: cluster.observations.length,
    confidence,
  };
}
