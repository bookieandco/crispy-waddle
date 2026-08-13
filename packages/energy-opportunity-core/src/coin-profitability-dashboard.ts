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
  const compatibleSymbols = new Set(
    profitability.filter((item) => item.compatible).map((item) => item.symbol),
  );
  const projected = [...projections]
    .filter((item) => compatibleSymbols.has(item.symbol))
    .sort((a, b) => b.expectedNetPerHour - a.expectedNetPerHour);
  const recommendedSymbol = projected[0]?.symbol ?? null;
  const projectedNetPerHour = projected[0]?.expectedNetPerHour ?? 0;

  return {
    generatedAt,
    projected,
    recommendedSymbol,
    projectedNetPerHour,
    realizedNet,
  };
}
