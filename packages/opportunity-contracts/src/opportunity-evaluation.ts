export type OpportunityDecision = "promising" | "watch" | "reject";

export interface OpportunityEvaluationInputs {
  evidenceIds: string[];
  demandScore: number;
  competitionScore: number;
  marginScore: number;
  supplierRiskScore: number;
  operationalComplexityScore: number;
  capitalRequirementScore: number;
  confidence: number;
}

export interface OpportunityEvaluation {
  opportunityId: string;
  score: number;
  decision: OpportunityDecision;
  inputs: OpportunityEvaluationInputs;
  reasons: string[];
  evaluatedAt: string;
  evaluatorVersion: string;
}

export interface OpportunityEvaluationPolicy {
  minimumPromisingScore: number;
  minimumConfidence: number;
  maximumSupplierRiskScore: number;
  maximumOperationalComplexityScore: number;
  maximumCapitalRequirementScore: number;
}

export interface OpportunityEvaluationEngine {
  evaluate(
    opportunityId: string,
    inputs: OpportunityEvaluationInputs,
    policy: OpportunityEvaluationPolicy,
  ): OpportunityEvaluation;
}
