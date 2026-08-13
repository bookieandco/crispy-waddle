export type MediaType = "youtube" | "movie" | "music" | "jhadina_work";
export type CreativeDomain = "music" | "visual" | "story" | "editing" | "performance" | "writing" | "design";
export type FeedbackSignal = "positive" | "negative";
export type FeedbackScope = "media" | "scene" | "segment" | "technique";
export type TasteStatus = "candidate" | "approved" | "rejected";

export interface EvidenceRef {
  sourceId: string;
  kind: "measurement" | "observation" | "feedback" | "reference";
  note?: string;
}

export interface MediaItem {
  id: string;
  type: MediaType;
  title: string;
  creator?: string;
  sourceUri: string;
  durationMs?: number;
  provenance: {
    source: string;
    authorized: boolean;
  };
}

export interface CreativeObservation {
  id: string;
  mediaId: string;
  domain: CreativeDomain;
  technique: string;
  startMs?: number;
  endMs?: number;
  measurement?: Record<string, number | string | boolean>;
  interpretation: string;
  evidence: EvidenceRef[];
  confidence: number;
}

export interface CreativeFeedback {
  id: string;
  targetId: string;
  signal: FeedbackSignal;
  scope: FeedbackScope;
  reason?: string;
  createdAt: string;
}

export interface TasteHypothesis {
  id: string;
  domain: CreativeDomain;
  pattern: string;
  supportingEvidence: string[];
  positiveCount: number;
  negativeCount: number;
  confidence: number;
  status: TasteStatus;
}

export interface CreativePreference {
  id: string;
  hypothesisId: string;
  domain: CreativeDomain;
  preference: string;
  confidence: number;
  provenance: string[];
  approvedAt: string;
}

export interface CreativeContext {
  domain: CreativeDomain;
  task: string;
  approvedPreferences: CreativePreference[];
  relevantObservations: CreativeObservation[];
}
