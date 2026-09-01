import type { GrowthId } from '../domain/types.js';
import type { SignalCluster } from './media-signal-deduplication.js';

export type TrendStage = 'stable' | 'rising' | 'accelerating' | 'breakout' | 'declining';

export interface TrendObservation {
  readonly clusterId: GrowthId;
  readonly observedAt: string;
  readonly signalCount: number;
  readonly sourceCount: number;
}

export interface TrendAssessment {
  readonly clusterId: GrowthId;
  readonly stage: TrendStage;
  readonly velocity: number;
  readonly acceleration: number;
  readonly sourceDiversity: number;
  readonly confidence: number;
}

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export function assessTrend(cluster: SignalCluster, previous?: TrendObservation, current?: TrendObservation): TrendAssessment {
  if (!previous || !current) {
    return { clusterId: cluster.id, stage: 'stable', velocity: 0, acceleration: 0, sourceDiversity: clamp(cluster.sourceCount / 5), confidence: cluster.confidence };
  }
  const elapsedHours = Math.max((Date.parse(current.observedAt) - Date.parse(previous.observedAt)) / 3600000, 1);
  const velocity = Math.max(0, (current.signalCount - previous.signalCount) / elapsedHours);
  const previousVelocity = Math.max(0, (previous.signalCount - Math.max(0, previous.signalCount - 1)) / elapsedHours);
  const acceleration = velocity - previousVelocity;
  const sourceDiversity = clamp(current.sourceCount / 5);
  let stage: TrendStage = 'stable';
  if (current.signalCount < previous.signalCount) stage = 'declining';
  else if (velocity >= 2 && acceleration > 0.5 && sourceDiversity >= 0.6) stage = 'breakout';
  else if (velocity >= 1 && acceleration > 0) stage = 'accelerating';
  else if (velocity > 0) stage = 'rising';
  return { clusterId: cluster.id, stage, velocity, acceleration, sourceDiversity, confidence: cluster.confidence };
}
