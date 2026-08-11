export type MiningDecision = 'run' | 'do_not_run' | 'insufficient_data';

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

export interface MiningDecisionRecord {
  decisionId: string;
  resourceId: string;
  decision: MiningDecision;
  observedAt: string;
  projectedGrossPerHour: number | null;
  projectedElectricityPerHour: number | null;
  projectedNetPerHour: number | null;
  health: MiningDecisionInput['health'];
  confidence: number;
  reasons: string[];
  policyVersion: string;
}

const POLICY_VERSION = 'mining-economic-v1';

/** Advisory only: this function never starts, stops, or controls mining hardware. */
export function evaluateMiningOpportunity(input: MiningDecisionInput): MiningDecisionRecord {
  const confidence = Math.min(1, Math.max(0, input.confidence));
  const minimumConfidence = Math.min(1, Math.max(0, input.minimumConfidence ?? 0.7));
  const minimumNet = input.minimumNetPerHour ?? 0;
  const reasons: string[] = [];
  let decision: MiningDecision = 'insufficient_data';

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
      decision = 'run';
      reasons.push('projected net economics satisfy policy');
    } else {
      decision = 'do_not_run';
      reasons.push(net < minimumNet ? 'projected net economics are below policy threshold' : 'resource health does not satisfy run policy');
    }
  }

  const net = input.projectedGrossPerHour !== null && input.projectedElectricityPerHour !== null
    ? input.projectedGrossPerHour - input.projectedElectricityPerHour
    : null;

  return {
    decisionId: `mining-decision:${input.resourceId}:${input.observedAt ?? Date.now()}`,
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
  };
}
