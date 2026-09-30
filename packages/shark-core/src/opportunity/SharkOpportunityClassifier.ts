import type { SharkFusedSignal } from '../risk/SharkSignalFusion';

export type SharkOpportunityClass =
  | 'TRAP'
  | 'AVOID'
  | 'WATCH'
  | 'EARLY'
  | 'HOT'
  | 'MIGRATION_PLAY'
  | 'CONVICTION';

export interface SharkOpportunityClassification {
  readonly classification: SharkOpportunityClass;
  readonly opportunityScore: number;
  readonly riskScore: number;
  readonly rugRisk: number;
  readonly confidence: number;
  readonly uncertainty: readonly string[];
  readonly reasonCodes: readonly string[];
}

/**
 * Converts fused intelligence into a decision-neutral market classification.
 * This layer never authorizes or executes a trade.
 */
export function classifySharkOpportunity(
  fused: SharkFusedSignal,
): SharkOpportunityClassification {
  const opportunityScore = clamp(fused.score);
  const riskScore = clamp(fused.risk.riskScore);
  const rugRisk = clamp(fused.risk.rugRisk);
  const confidence = clamp(fused.confidence);
  const uncertainty: string[] = [];
  const reasonCodes: string[] = fused.risk.flags.map(flag => flag.code);

  if (confidence < 0.5) uncertainty.push('LOW_CONFIDENCE');
  if (fused.contradiction > 0) uncertainty.push('CONTRADICTORY_EVIDENCE');
  if (fused.corroboration < 0.5) uncertainty.push('LIMITED_SOURCE_CORROBORATION');

  let classification: SharkOpportunityClass;

  if (fused.risk.blocked && rugRisk >= 0.7) {
    classification = 'TRAP';
  } else if (rugRisk >= 0.45 || riskScore >= 0.65) {
    classification = 'AVOID';
  } else if (fused.risk.flags.some(flag => flag.code === 'MIGRATION_RISK')) {
    classification = 'MIGRATION_PLAY';
  } else if (confidence < 0.6 || opportunityScore < 0.35) {
    classification = 'WATCH';
  } else if (opportunityScore >= 0.8 && confidence >= 0.8 && riskScore < 0.3 && rugRisk < 0.2) {
    classification = 'CONVICTION';
  } else if (opportunityScore >= 0.65 && confidence >= 0.65 && riskScore < 0.45) {
    classification = 'HOT';
  } else {
    classification = 'EARLY';
  }

  return {
    classification,
    opportunityScore,
    riskScore,
    rugRisk,
    confidence,
    uncertainty,
    reasonCodes,
  };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
