import type { CoinProfitability } from './coin-profitability.ts';

export interface CoinMoneyProjection {
  symbol: string;
  currency: 'USD';
  expectedNetPerHour: number;
  expectedGrossPerHour: number;
  electricityPerHour: number;
  poolFeesPerHour: number;
  confidence: number;
  status: 'projected';
}

export interface CoinMoneyProjectionInput {
  profitability: CoinProfitability;
  grossRevenuePerHour: number;
  electricityCostPerHour: number;
  poolFeesPerHour: number;
}

/** Converts advisory mining economics into a Money Core-compatible projection only. */
export function projectCoinMoney(input: CoinMoneyProjectionInput): CoinMoneyProjection {
  return {
    symbol: input.profitability.symbol,
    currency: 'USD',
    expectedNetPerHour: input.profitability.expectedNetPerHour,
    expectedGrossPerHour: Math.max(0, input.grossRevenuePerHour),
    electricityPerHour: Math.max(0, input.electricityCostPerHour),
    poolFeesPerHour: Math.max(0, input.poolFeesPerHour),
    confidence: input.profitability.confidence,
    status: 'projected',
  };
}
