import type { MiningFinancialEvent } from './financial-events.ts';

export interface MiningProfitabilityDashboard {
  resourceId: string;
  grossUsd: number;
  electricityUsd: number;
  realizedBtc: number;
  realizedUsd: number;
  netUsd: number;
  eventCount: number;
  status: 'profitable' | 'break-even' | 'unprofitable' | 'insufficient-data';
}

/** Builds a read-only dashboard projection from append-only governed events. */
export function buildMiningProfitabilityDashboard(
  resourceId: string,
  events: readonly MiningFinancialEvent[],
): MiningProfitabilityDashboard {
  const relevant = events.filter((event) => event.resourceId === resourceId);
  let grossUsd = 0;
  let electricityUsd = 0;
  let realizedBtc = 0;
  let realizedUsd = 0;

  for (const event of relevant) {
    if (event.kind === 'mining_economics_projected') grossUsd += event.estimatedGrossPerHour;
    if (event.kind === 'electricity_expense_observed') electricityUsd += event.amountUsd;
    if (event.kind === 'mining_payout_verified') realizedBtc += event.amountBtc;
    if (event.kind === 'mining_profitability_snapshot') {
      realizedUsd += event.realizedUsd;
    }
  }

  const netUsd = realizedUsd + grossUsd - electricityUsd;
  const status = relevant.length === 0
    ? 'insufficient-data'
    : netUsd > 0
      ? 'profitable'
      : netUsd === 0
        ? 'break-even'
        : 'unprofitable';

  return { resourceId, grossUsd, electricityUsd, realizedBtc, realizedUsd, netUsd, eventCount: relevant.length, status };
}
