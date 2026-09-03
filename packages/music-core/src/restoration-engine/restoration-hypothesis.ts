export type RestorationHypothesisKind =
  | "damage"
  | "intentional"
  | "transfer-artifact"
  | "performance"
  | "missing-signal"
  | "unknown";

export interface HypothesisObservation {
  evidenceId: string;
  likelihood: number;
  notes?: string;
}

export interface RestorationHypothesis {
  id: string;
  kind: RestorationHypothesisKind;
  label: string;
  prior: number;
  observations: HypothesisObservation[];
  posterior?: number;
}

export interface RestorationHypothesisSet {
  id: string;
  caseId: string;
  sourceVersionId: string;
  evidenceIds: string[];
  hypotheses: RestorationHypothesis[];
}

export interface HypothesisUpdate {
  hypothesisId: string;
  evidenceId: string;
  likelihood: number;
}

export function validateRestorationHypothesisSet(set: RestorationHypothesisSet): void {
  if (!set.id || !set.caseId || !set.sourceVersionId) throw new Error("Hypothesis set identity is required");
  if (set.hypotheses.length === 0) throw new Error("At least one restoration hypothesis is required");
  const ids = new Set<string>();
  let priorTotal = 0;
  for (const hypothesis of set.hypotheses) {
    if (!hypothesis.id || ids.has(hypothesis.id)) throw new Error("Hypothesis IDs must be unique");
    ids.add(hypothesis.id);
    assertProbability(hypothesis.prior, "Hypothesis prior");
    if (hypothesis.posterior !== undefined) assertProbability(hypothesis.posterior, "Hypothesis posterior");
    priorTotal += hypothesis.prior;
    for (const observation of hypothesis.observations) {
      if (!observation.evidenceId) throw new Error("Hypothesis observation evidence ID is required");
      assertProbability(observation.likelihood, "Hypothesis likelihood");
    }
  }
  if (Math.abs(priorTotal - 1) > 1e-9) throw new Error("Hypothesis priors must sum to 1");
}

export function updateHypothesisPosterior(
  hypothesis: RestorationHypothesis,
  likelihood: number,
): RestorationHypothesis {
  assertProbability(likelihood, "Hypothesis likelihood");
  return {
    ...hypothesis,
    observations: [...hypothesis.observations],
    posterior: hypothesis.prior * likelihood,
  };
}

export function normalizeHypothesisPosteriors(hypotheses: RestorationHypothesis[]): RestorationHypothesis[] {
  const total = hypotheses.reduce((sum, hypothesis) => sum + (hypothesis.posterior ?? 0), 0);
  if (!(total > 0) || !Number.isFinite(total)) throw new Error("Hypothesis posterior mass must be positive");
  return hypotheses.map((hypothesis) => ({ ...hypothesis, posterior: (hypothesis.posterior ?? 0) / total }));
}

function assertProbability(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${label} must be between 0 and 1`);
}
