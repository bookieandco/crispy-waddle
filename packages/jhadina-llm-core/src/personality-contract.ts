export type PersonalityTrait =
  | "openness"
  | "conscientiousness"
  | "extraversion"
  | "agreeableness"
  | "neuroticism"
  | "curiosity"
  | "novelty-seeking"
  | "directness"
  | "humor"
  | "risk-tolerance";

export type PersonalityEvidenceType =
  | "explicit-user-statement"
  | "repeated-choice"
  | "conversation-pattern"
  | "behavioral-signal"
  | "experience-reaction"
  | "self-report"
  | "inferred";

export interface PersonalityEvidence {
  id: string;
  type: PersonalityEvidenceType;
  statement: string;
  sourceId?: string;
  observedAt: string;
  context?: string;
  confidence: number;
  userConfirmed?: boolean;
}

export interface PersonalitySignal {
  id: string;
  trait: PersonalityTrait | string;
  direction: "low" | "moderate" | "high" | "mixed";
  strength: number;
  confidence: number;
  evidence: PersonalityEvidence[];
  contexts: string[];
  firstObservedAt: string;
  lastObservedAt: string;
  status: "candidate" | "established" | "reconsider" | "archived";
}

export interface UserModel {
  userId: string;
  identity: Record<string, unknown>;
  preferences: Array<{ key: string; value: unknown; confidence: number; sourceIds: string[] }>;
  traits: PersonalitySignal[];
  communicationStyle: Record<string, unknown>;
  currentInterests: Array<{ topic: string; strength: number; sourceIds: string[] }>;
  boundaries: Array<{ statement: string; sourceId?: string; confidence: number }>;
  updatedAt: string;
}

export interface PersonalityObservationEngine {
  observe(input: {
    userId: string;
    sourceId: string;
    text: string;
    context?: string;
  }): Promise<PersonalityEvidence[]>;
}

export interface PersonalityRepository {
  get(userId: string): Promise<UserModel | null>;
  save(model: UserModel): Promise<UserModel>;
}
