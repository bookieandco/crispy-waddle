export type AttentionPriority = 'P0' | 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
export type Confidence = number;

export interface Evidence {
  id: string;
  source: string;
  observedAt: string;
  summary: string;
}

export interface Preference {
  id: string;
  statement: string;
  confidence: Confidence;
  stability: number;
  evidence: Evidence[];
  status: 'candidate' | 'accepted' | 'contested' | 'retired';
}

export interface Opinion {
  id: string;
  statement: string;
  confidence: Confidence;
  evidence: Evidence[];
  formedAt: string;
  lastReviewedAt: string;
  status: 'active' | 'contested' | 'retired';
}

export interface Commitment {
  id: string;
  statement: string;
  owner: 'user' | 'jhadina' | 'shared';
  priority: AttentionPriority;
  dueAt?: string;
  status: 'open' | 'completed' | 'broken' | 'cancelled';
}

export interface OpenLoop {
  id: string;
  description: string;
  priority: AttentionPriority;
  lastTouchedAt: string;
  status: 'open' | 'blocked' | 'waiting' | 'closed';
}

export interface RelationshipSignal {
  subjectId: string;
  trust: number;
  familiarity: number;
  reliability: number;
  evidence: Evidence[];
  lastObservedAt: string;
}

export interface RealState {
  version: number;
  identity: {
    id: string;
    name: string;
    continuityKey: string;
  };
  currentContext: string[];
  activeGoals: string[];
  priorities: Array<{ id: string; statement: string; priority: AttentionPriority }>;
  attention: {
    subject: string;
    priority: AttentionPriority;
    reason: string;
    since: string;
  };
  preferences: Preference[];
  opinions: Opinion[];
  commitments: Commitment[];
  openLoops: OpenLoop[];
  relationships: RelationshipSignal[];
  recentExperiences: string[];
  learnedPatterns: string[];
  confidence: Confidence;
  uncertainty: string[];
  tone: {
    directness: number;
    warmth: number;
    humor: number;
    formality: number;
  };
  updatedAt: string;
}

export const DEFAULT_REAL_STATE: RealState = {
  version: 1,
  identity: { id: 'jhadina', name: 'Jhadina', continuityKey: 'jhadina-primary' },
  currentContext: [],
  activeGoals: [],
  priorities: [],
  attention: { subject: 'none', priority: 'P5', reason: 'No active priority', since: '' },
  preferences: [],
  opinions: [],
  commitments: [],
  openLoops: [],
  relationships: [],
  recentExperiences: [],
  learnedPatterns: [],
  confidence: 0.5,
  uncertainty: [],
  tone: { directness: 0.8, warmth: 0.7, humor: 0.5, formality: 0.25 },
  updatedAt: '',
};
