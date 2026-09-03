export type ISODateTime = string;
export type Sport = 'NFL' | 'NBA' | 'MLB' | 'NHL' | 'SOCCER' | 'TENNIS' | 'OTHER';
export type EvidenceDomain = 'WORLD' | 'MARKET';
export type EvidenceQuality = 'VERIFIED' | 'SUPPORTED' | 'STALE' | 'CONFLICTING' | 'UNKNOWN';

export interface EvidenceRef {
  evidenceId: string;
  sourceId: string;
  domain: EvidenceDomain;
  observedAt: ISODateTime;
  receivedAt: ISODateTime;
  quality: EvidenceQuality;
  contentHash: string;
}

export interface FeatureSnapshot {
  snapshotId: string;
  asOf: ISODateTime;
  contentHash: string;
  featureSetVersion: string;
  evidenceIds: string[];
}

export interface PredictionDistribution {
  outcomes: Array<{ outcome: string; probability: number }>;
  modelId: string;
  modelVersion: string;
  ensembleVersion?: string;
}

export interface PredictionRecord {
  predictionId: string;
  eventId: string;
  sport: Sport;
  marketId?: string;
  predictionCutoff: ISODateTime;
  createdAt: ISODateTime;
  featureSnapshot: FeatureSnapshot;
  evidence: EvidenceRef[];
  distribution: PredictionDistribution;
  calibrationVersion: string;
  confidence: number;
  uncertainty: number;
  inputHash: string;
}

export interface ActualOutcome {
  eventId: string;
  outcome: string;
  observedAt: ISODateTime;
  evidenceIds: string[];
}

export interface PredictionEvaluation {
  predictionId: string;
  eventId: string;
  brierScore: number;
  logLoss: number;
  predictedProbability: number;
  outcome: string;
  evaluatedAt: ISODateTime;
  calibrationVersion: string;
}

export interface RealityState {
  eventId: string;
  stateVersion: number;
  asOf: ISODateTime;
  sourceEvidenceIds: string[];
  worldState: Record<string, unknown>;
  canonical: boolean;
  stateHash: string;
}
