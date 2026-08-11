export type TraitState = "OBSERVED" | "REPEATED" | "EMERGING" | "ESTABLISHED" | "REVISED";

export type TraitCategory =
  | "PREFERENCE"
  | "COMMUNICATION"
  | "INTEREST"
  | "DISLIKE"
  | "STANDARD"
  | "HUMOR"
  | "CURIOSITY"
  | "RISK_TOLERANCE"
  | "BOUNDARY"
  | "OPINION";

export interface TraitEvidence {
  id: string;
  observedAt: string;
  source: "INTERACTION" | "MEMORY" | "DECISION" | "OUTCOME";
  summary: string;
  confidence: number;
  userApproved: boolean;
}

export interface PersonalityTrait {
  id: string;
  category: TraitCategory;
  statement: string;
  state: TraitState;
  confidence: number;
  evidence: TraitEvidence[];
  firstObservedAt: string;
  lastObservedAt: string;
  contradictionCount: number;
  revisionCount: number;
}

export interface PersonalityState {
  version: number;
  traits: PersonalityTrait[];
  updatedAt: string;
}

export interface PersonalityObservation {
  category: TraitCategory;
  statement: string;
  source: TraitEvidence["source"];
  summary: string;
  confidence: number;
  userApproved: boolean;
  observedAt?: string;
}

export interface PersonalityDevelopmentPolicy {
  minimumRepeatedEvidence: number;
  establishmentThreshold: number;
  contradictionThreshold: number;
}

export const DEFAULT_PERSONALITY_POLICY: PersonalityDevelopmentPolicy = {
  minimumRepeatedEvidence: 3,
  establishmentThreshold: 0.8,
  contradictionThreshold: 2,
};

export function observePersonality(
  state: PersonalityState,
  observation: PersonalityObservation,
  policy: PersonalityDevelopmentPolicy = DEFAULT_PERSONALITY_POLICY,
): PersonalityState {
  const now = observation.observedAt ?? new Date().toISOString();
  const matching = state.traits.find(
    (trait) =>
      trait.category === observation.category &&
      trait.statement.toLowerCase() === observation.statement.toLowerCase(),
  );

  if (!matching) {
    const trait: PersonalityTrait = {
      id: crypto.randomUUID(),
      category: observation.category,
      statement: observation.statement,
      state: "OBSERVED",
      confidence: Math.min(1, observation.confidence),
      evidence: [
        {
          id: crypto.randomUUID(),
          observedAt: now,
          source: observation.source,
          summary: observation.summary,
          confidence: observation.confidence,
          userApproved: observation.userApproved,
        },
      ],
      firstObservedAt: now,
      lastObservedAt: now,
      contradictionCount: 0,
      revisionCount: 0,
    };

    return { ...state, version: state.version + 1, traits: [...state.traits, trait], updatedAt: now };
  }

  const evidence: TraitEvidence = {
    id: crypto.randomUUID(),
    observedAt: now,
    source: observation.source,
    summary: observation.summary,
    confidence: observation.confidence,
    userApproved: observation.userApproved,
  };
  const nextEvidence = [...matching.evidence, evidence];
  const confidence = Math.min(
    1,
    matching.confidence * 0.7 + observation.confidence * 0.3,
  );
  const stateForTrait: TraitState =
    nextEvidence.length >= policy.minimumRepeatedEvidence && confidence >= policy.establishmentThreshold
      ? "ESTABLISHED"
      : nextEvidence.length > 1
        ? "REPEATED"
        : "OBSERVED";

  const updatedTrait: PersonalityTrait = {
    ...matching,
    evidence: nextEvidence,
    confidence,
    state: stateForTrait,
    lastObservedAt: now,
  };

  return {
    ...state,
    version: state.version + 1,
    traits: state.traits.map((trait) => (trait.id === matching.id ? updatedTrait : trait)),
    updatedAt: now,
  };
}

export function registerContradiction(
  state: PersonalityState,
  traitId: string,
  revisionStatement: string,
): PersonalityState {
  const now = new Date().toISOString();
  return {
    ...state,
    version: state.version + 1,
    traits: state.traits.map((trait) =>
      trait.id === traitId
        ? {
            ...trait,
            statement: revisionStatement,
            state: "REVISED",
            contradictionCount: trait.contradictionCount + 1,
            revisionCount: trait.revisionCount + 1,
            lastObservedAt: now,
          }
        : trait,
    ),
    updatedAt: now,
  };
}

export function shouldDisagreeWithUser(
  establishedTrait: PersonalityTrait | undefined,
  evidenceConfidence = 0,
): boolean {
  return Boolean(
    establishedTrait &&
      establishedTrait.state === "ESTABLISHED" &&
      establishedTrait.category === "OPINION" &&
      establishedTrait.confidence >= 0.8 &&
      evidenceConfidence < establishedTrait.confidence,
  );
}
