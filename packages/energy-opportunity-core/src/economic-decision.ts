export type MiningOpportunityDecision =
  | 'eligible'
  | 'do_not_run'
  | 'insufficient_data';

export interface MiningDecisionInput {
  resourceId: string;
  projectedGrossPerHour: number | null;
  projectedElectricityPerHour: number | null;
  health: 'healthy' | 'degraded' | 'offline' | 'unknown';
  confidence: number;
  minimumNetPerHour?: number;
  minimumConfidence?: number;
  observedAt?: string;
}

export interface MiningOpportunityAssessment {
  assessmentId: string;
  resourceId: string;
  decision: MiningOpportunityDecision;
  observedAt: string;
  projectedGrossPerHour: number | null;
  projectedElectricityPerHour: number | null;
  projectedNetPerHour: number | null;
  health: MiningDecisionInput['health'];
  confidence: number;
  reasons: string[];
  policyVersion: string;
  authorizationRequired: true;
  authorized: false;
  executionPermitted: false;
}

const POLICY_VERSION = 'mining-economic-v2';

/**
 * Advisory-only mining economics assessment.
 *
 * This function evaluates whether observed economics satisfy policy. It never
 * authorizes, starts, stops, or controls mining hardware and never moves funds.
 */
export function evaluateMiningOpportunity(
  input: MiningDecisionInput,
): MiningOpportunityAssessment {
  const confidence = Math.min(1, Math.max(0, input.confidence));
  const minimumConfidence = Math.min(1, Math.max(0, input.minimumConfidence ?? 0.7));
  const minimumNet = input.minimumNetPerHour ?? 0;
  const reasons: string[] = [];
  let decision: MiningOpportunityDecision = 'insufficient_data';

  if (input.projectedGrossPerHour === null || input.projectedElectricityPerHour === null) {
    reasons.push('economic inputs are incomplete');
  } else if (input.health === 'offline' || input.health === 'unknown') {
    reasons.push(`resource health is ${input.health}`);
  } else if (confidence < minimumConfidence) {
    reasons.push('confidence is below policy threshold');
  } else {
    const net = input.projectedGrossPerHour - input.projectedElectricityPerHour;

    if (input.health === 'degraded') {
      reasons.push('resource health is degraded');
    }

    if (net >= minimumNet && input.health === 'healthy') {
      decision = 'eligible';
      reasons.push('projected net economics satisfy policy');
    } else {
      decision = 'do_not_run';
      reasons.push(
        net < minimumNet
          ? 'projected net economics are below policy threshold'
          : 'resource health does not satisfy run policy',
      );
    }
  }

  const net =
    input.projectedGrossPerHour !== null && input.projectedElectricityPerHour !== null
      ? input.projectedGrossPerHour - input.projectedElectricityPerHour
      : null;

  return {
    assessmentId: `mining-opportunity:${input.resourceId}:${input.observedAt ?? Date.now()}`,
    resourceId: input.resourceId,
    decision,
    observedAt: input.observedAt ?? new Date().toISOString(),
    projectedGrossPerHour: input.projectedGrossPerHour,
    projectedElectricityPerHour: input.projectedElectricityPerHour,
    projectedNetPerHour: net,
    health: input.health,
    confidence,
    reasons,
    policyVersion: POLICY_VERSION,
    authorizationRequired: true,
    authorized: false,
    executionPermitted: false,
  };
}
