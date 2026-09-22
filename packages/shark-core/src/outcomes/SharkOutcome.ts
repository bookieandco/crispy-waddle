export type OutcomeLabel =
  | 'win'
  | 'loss'
  | 'flat'
  | 'rug'
  | 'missed'
  | 'unknown';

export interface SharkOutcome {
  readonly id: string;
  readonly decisionId: string;
  readonly subjectId: string;
  readonly resolvedAt: string;
  readonly label: OutcomeLabel;
  readonly entryValue?: number;
  readonly exitValue?: number;
  readonly returnPct?: number;
  readonly maxDrawdownPct?: number;
  readonly durationSeconds?: number;
  readonly realizedRisk?: number;
  readonly evidenceIds: readonly string[];
  readonly notes?: readonly string[];
}

export interface LearningSample {
  readonly decisionId: string;
  readonly outcome: SharkOutcome;
  readonly featureVector: Readonly<Record<string, number>>;
}
