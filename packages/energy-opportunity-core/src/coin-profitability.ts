import type { MiningOpportunity } from './coin-registry.ts';

export interface CoinProfitabilityInput {
  opportunity: MiningOpportunity;
  grossRevenuePerHour: number;
  electricityCostPerHour: number;
  poolFeesPerHour: number;
  confidence: number;
}

export interface CoinProfitability {
  symbol: string;
  compatible: boolean;
  expectedNetPerHour: number;
  confidence: number;
  reasonCodes: string[];
}

export function rankMiningProfitability(
  inputs: readonly CoinProfitabilityInput[],
): CoinProfitability[] {
  return inputs
    .map((input) => ({
      symbol: input.opportunity.coin.symbol,
      compatible: input.opportunity.compatible,
      expectedNetPerHour:
        input.grossRevenuePerHour - input.electricityCostPerHour - input.poolFeesPerHour,
      confidence: input.confidence,
      reasonCodes: input.opportunity.compatible
        ? ['ECONOMICS_EVALUATED']
        : [...input.opportunity.reasonCodes, 'NOT_ELIGIBLE'],
    }))
    .sort((a, b) => b.expectedNetPerHour - a.expectedNetPerHour);
}
