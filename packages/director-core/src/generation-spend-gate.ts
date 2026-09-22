export type GenerationPricingUnit = 'per-second' | 'per-token' | 'per-image' | 'per-request' | 'custom';

export interface GenerationCostEstimate {
  id: string;
  projectId: string;
  provider: string;
  modelId: string;
  pricingUnit: GenerationPricingUnit;
  pricingSourceRef: string;
  quantity: number;
  unitPriceUsd: number;
  estimatedCostUsd: number;
  derivedAt: string;
  assumptions: readonly string[];
}

export interface GenerationSpendAuthorization {
  estimateId: string;
  approvedMaximumUsd: number;
  approvedBy: string;
  approvedAt: string;
}

export interface GenerationSpendDecision {
  authorized: boolean;
  reasons: readonly string[];
}

/**
 * Generative media spend requires a derived estimate with provenance and an
 * explicit budget ceiling. Pricing itself stays outside Director and may be
 * refreshed by provider adapters.
 */
export function authorizeGenerationSpend(
  estimate: GenerationCostEstimate,
  authorization: GenerationSpendAuthorization | undefined,
): GenerationSpendDecision {
  const reasons: string[] = [];
  if (!estimate.id.trim() || !estimate.projectId.trim()) reasons.push('DIRECTOR_COST_ESTIMATE_IDENTITY_REQUIRED');
  if (!estimate.provider.trim() || !estimate.modelId.trim()) reasons.push('DIRECTOR_COST_PROVIDER_REQUIRED');
  if (!estimate.pricingSourceRef.trim()) reasons.push('DIRECTOR_COST_SOURCE_REQUIRED');
  if (!Number.isFinite(estimate.quantity) || estimate.quantity <= 0) reasons.push('DIRECTOR_COST_QUANTITY_INVALID');
  if (!Number.isFinite(estimate.unitPriceUsd) || estimate.unitPriceUsd < 0) reasons.push('DIRECTOR_COST_UNIT_PRICE_INVALID');
  if (!Number.isFinite(estimate.estimatedCostUsd) || estimate.estimatedCostUsd < 0) reasons.push('DIRECTOR_COST_TOTAL_INVALID');

  const recomputed = estimate.quantity * estimate.unitPriceUsd;
  if (Math.abs(recomputed - estimate.estimatedCostUsd) > 0.01) {
    reasons.push('DIRECTOR_COST_ESTIMATE_MISMATCH');
  }

  if (!authorization) reasons.push('DIRECTOR_COST_AUTHORIZATION_REQUIRED');
  else {
    if (authorization.estimateId !== estimate.id) reasons.push('DIRECTOR_COST_AUTHORIZATION_MISMATCH');
    if (!Number.isFinite(authorization.approvedMaximumUsd) || authorization.approvedMaximumUsd < estimate.estimatedCostUsd) {
      reasons.push('DIRECTOR_COST_BUDGET_EXCEEDED');
    }
    if (!authorization.approvedBy.trim() || !authorization.approvedAt.trim()) {
      reasons.push('DIRECTOR_COST_AUTHORIZATION_RECEIPT_REQUIRED');
    }
  }

  return Object.freeze({ authorized: reasons.length === 0, reasons: Object.freeze(reasons) });
}
