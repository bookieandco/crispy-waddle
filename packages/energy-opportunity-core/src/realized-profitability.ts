import type { MiningFinancialEvent, MiningPayoutVerifiedEvent } from './financial-events.ts';

export interface RealizedProfitabilityInput {
  resourceId: string;
  btcUsdRate?: number;
  events: readonly MiningFinancialEvent[];
}

export interface RealizedProfitability {
  resourceId: string;
  verifiedBtc: number;
  realizedGrossUsd: number;
  electricityUsd: number;
  realizedNetUsd: number | null;
  projectedGrossUsd: number;
  projectedNetUsd: number | null;
  varianceUsd: number | null;
  verifiedPayoutCount: number;
}

function verifiedPayouts(events: readonly MiningFinancialEvent[], resourceId: string): MiningPayoutVerifiedEvent[] {
  return events.filter((event): event is MiningPayoutVerifiedEvent =>
    event.resourceId === resourceId && event.kind === 'mining_payout_verified');
}

/**
 * Reconciles only verified payouts and observed electricity expenses.
 * A USD BTC valuation is required before realized BTC can become realized USD.
 */
export function reconcileRealizedProfitability(input: RealizedProfitabilityInput): RealizedProfitability {
  const relevant = input.events.filter((event) => event.resourceId === input.resourceId);
  const payouts = verifiedPayouts(relevant, input.resourceId);
  const verifiedBtc = payouts.reduce((sum, payout) => sum + Math.max(0, payout.amountBtc), 0);
  const electricityUsd = relevant
    .filter((event) => event.kind === 'electricity_expense_observed')
    .reduce((sum, event) => sum + Math.max(0, event.amountUsd), 0);
  const projectedGrossUsd = relevant
    .filter((event) => event.kind === 'mining_economics_projected')
    .reduce((sum, event) => sum + Math.max(0, event.estimatedGrossPerHour), 0);
  const realizedGrossUsd = input.btcUsdRate !== undefined
    ? verifiedBtc * Math.max(0, input.btcUsdRate)
    : 0;
  const realizedNetUsd = input.btcUsdRate === undefined ? null : realizedGrossUsd - electricityUsd;
  const projectedNetUsd = relevant.some((event) => event.kind === 'mining_economics_projected')
    ? projectedGrossUsd - electricityUsd
    : null;
  const varianceUsd = realizedNetUsd === null || projectedNetUsd === null
    ? null
    : realizedNetUsd - projectedNetUsd;

  return {
    resourceId: input.resourceId,
    verifiedBtc,
    realizedGrossUsd,
    electricityUsd,
    realizedNetUsd,
    projectedGrossUsd,
    projectedNetUsd,
    varianceUsd,
    verifiedPayoutCount: payouts.length,
  };
}
