export type DecisionPosture =
  | 'watch'
  | 'avoid'
  | 'paper_trade'
  | 'prepare'
  | 'human_review'
  | 'execute';

export interface SharkSignal {
  readonly name: string;
  readonly direction: 'bullish' | 'bearish' | 'neutral';
  readonly strength: number;
  readonly evidenceIds: readonly string[];
  readonly rationale: string;
}

export interface SharkDecision {
  readonly id: string;
  readonly subjectId: string;
  readonly createdAt: string;
  readonly posture: DecisionPosture;
  readonly score: number;
  readonly confidence: number;
  readonly expectedValue?: number;
  readonly riskScore: number;
  readonly rugRisk: number;
  readonly signals: readonly SharkSignal[];
  readonly supportingObservationIds: readonly string[];
  readonly conflictingObservationIds?: readonly string[];
  readonly uncertainty: readonly string[];
  readonly streetSmart: {
    readonly enabled: boolean;
    readonly flags: readonly string[];
    readonly patternMatches: readonly string[];
  };
  readonly learningContext: {
    readonly modelVersion: string;
    readonly comparableDecisionIds: readonly string[];
  };
  /** Execution is a downstream capability; Shark itself does not hold keys. */
  readonly authorizationRequired: boolean;
}

export function isActionable(decision: SharkDecision): boolean {
  return decision.confidence >= 0.8 &&
    decision.riskScore < 0.4 &&
    decision.rugRisk < 0.25 &&
    decision.authorizationRequired;
}
