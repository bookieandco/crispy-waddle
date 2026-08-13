import type { MiningDecisionRecord } from './economic-decision.ts';

export type CommandCenterDecision = 'RUN' | "DON'T RUN" | 'INSUFFICIENT DATA';

export interface MiningCommandCenterCard {
  resourceId: string;
  decision: CommandCenterDecision;
  confidence: number;
  observedAt: string;
  projectedGrossPerHour: number | null;
  projectedElectricityPerHour: number | null;
  projectedNetPerHour: number | null;
  health: MiningDecisionRecord['health'];
  reasons: string[];
  policyVersion: string;
}

export function buildMiningCommandCenterCard(record: MiningDecisionRecord): MiningCommandCenterCard {
  const decision: CommandCenterDecision =
    record.decision === 'run'
      ? 'RUN'
      : record.decision === 'do_not_run'
        ? "DON'T RUN"
        : 'INSUFFICIENT DATA';

  return {
    resourceId: record.resourceId,
    decision,
    confidence: record.confidence,
    observedAt: record.observedAt,
    projectedGrossPerHour: record.projectedGrossPerHour,
    projectedElectricityPerHour: record.projectedElectricityPerHour,
    projectedNetPerHour: record.projectedNetPerHour,
    health: record.health,
    reasons: [...record.reasons],
    policyVersion: record.policyVersion,
  };
}
