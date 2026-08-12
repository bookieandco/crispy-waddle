import type { CoinProfitability } from './coin-profitability.ts';
import type { CoinMoneyProjection } from './coin-moneycore-bridge.ts';

export interface CoinProfitabilityDashboard {
  generatedAt: string;
  projected: CoinMoneyProjection[];
  recommendedSymbol: string | null;
  projectedNetPerHour: number;
  realizedNet: number;
}

export function buildCoinProfitabilityDashboard(
  profitability: readonly CoinProfitability[],
  projections: readonly CoinMoneyProjection[],
  realizedNet = 0,
  generatedAt = new Date().toISOString(),
): CoinProfitabilityDashboard {
  const projected = [...projections].sort((a, b) => b.expectedNetPerHour - a.expectedNetPerHour);
  const eligible = profitability.filter((item) => item.compatible);
  const recommendedSymbol = eligible.length > 0 ? eligible[0].symbol : null;
  const projectedNetPerHour = projected.length > 0 ? projected[0].expectedNetPerHour : 0;

  return {
    generatedAt,
    projected,
    recommendedSymbol,
    projectedNetPerHour,
    realizedNet,
  };
}
