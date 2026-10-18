import { wattsToKwhPerDay } from './mining-fleet.ts';

export type MiningEconomicDecision = 'operate' | 'do-not-operate' | 'insufficient-data';

export interface MiningEconomicsInput {
  powerWatts: number;
  electricityPricePerKwh: number;
  expectedGrossRevenuePerDay: number;
  poolFeeRate?: number;
  otherDailyCost?: number;
  capitalCost?: number;
  minimumNetMarginPerDay?: number;
  maximumPaybackDays?: number;
}

export interface MiningEconomicsResult {
  energyKwhPerDay: number;
  energyCostPerDay: number;
  poolFeesPerDay: number;
  otherDailyCost: number;
  grossRevenuePerDay: number;
  netRevenuePerDay: number;
  netMarginRate: number | null;
  paybackDays: number | null;
  decision: MiningEconomicDecision;
  reasons: readonly string[];
}

function nonNegative(name: string, value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a finite non-negative number`);
  return value;
}

function feeRate(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('poolFeeRate must be between 0 and 1');
  return value;
}

/**
 * Deterministic advisory economics only. It consumes externally supplied
 * expected gross revenue; it does not fetch market data or execute mining.
 */
export function evaluateMiningEconomics(input: MiningEconomicsInput): MiningEconomicsResult {
  const powerWatts = nonNegative('powerWatts', input.powerWatts);
  const electricityPricePerKwh = nonNegative('electricityPricePerKwh', input.electricityPricePerKwh);
  const grossRevenuePerDay = nonNegative('expectedGrossRevenuePerDay', input.expectedGrossRevenuePerDay);
  const fee = feeRate(input.poolFeeRate ?? 0);
  const otherDailyCost = nonNegative('otherDailyCost', input.otherDailyCost ?? 0);
  const capitalCost = nonNegative('capitalCost', input.capitalCost ?? 0);
  const minimumNetMarginPerDay = nonNegative('minimumNetMarginPerDay', input.minimumNetMarginPerDay ?? 0);
  const maximumPaybackDays = input.maximumPaybackDays === undefined
    ? undefined
    : nonNegative('maximumPaybackDays', input.maximumPaybackDays);

  const energyKwhPerDay = wattsToKwhPerDay(powerWatts);
  const energyCostPerDay = energyKwhPerDay * electricityPricePerKwh;
  const poolFeesPerDay = grossRevenuePerDay * fee;
  const netRevenuePerDay = grossRevenuePerDay - poolFeesPerDay - energyCostPerDay - otherDailyCost;
  const netMarginRate = grossRevenuePerDay === 0 ? null : netRevenuePerDay / grossRevenuePerDay;
  const paybackDays = netRevenuePerDay > 0 && capitalCost > 0 ? capitalCost / netRevenuePerDay : null;

  const reasons: string[] = [];
  if (grossRevenuePerDay === 0) reasons.push('expected gross revenue is zero');
  if (netRevenuePerDay <= minimumNetMarginPerDay) reasons.push('net revenue is below the configured operating threshold');
  if (maximumPaybackDays !== undefined && (paybackDays === null || paybackDays > maximumPaybackDays)) {
    reasons.push('payback period exceeds the configured capital threshold');
  }

  let decision: MiningEconomicDecision = 'operate';
  if (grossRevenuePerDay === 0 || !Number.isFinite(netRevenuePerDay)) {
    decision = 'insufficient-data';
  } else if (reasons.length > 0) {
    decision = 'do-not-operate';
  }

  return {
    energyKwhPerDay,
    energyCostPerDay,
    poolFeesPerDay,
    otherDailyCost,
    grossRevenuePerDay,
    netRevenuePerDay,
    netMarginRate,
    paybackDays,
    decision,
    reasons,
  };
}
