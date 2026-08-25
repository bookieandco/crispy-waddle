export type LiquiditySnapshot = {
  cash: number;
  protectedCash: number;
  pendingObligations: number;
  pendingRevenue: number;
  investedValue: number;
  liquidInvestments: number;
  targetOperatingCash: number;
  targetInvestmentCash: number;
};

export type LiquidityRecommendation = {
  action: 'hold' | 'deposit' | 'withdraw' | 'reduce-exposure';
  amount: number;
  reasons: string[];
};

/** Recommendation-only. Never initiates a deposit, withdrawal, sale, or transfer. */
export function recommendLiquidityAction(snapshot: LiquiditySnapshot): LiquidityRecommendation {
  const safeCash = Math.max(snapshot.protectedCash, snapshot.pendingObligations + snapshot.targetOperatingCash);
  const excessCash = Math.max(0, snapshot.cash - safeCash);
  const cashGap = Math.max(0, safeCash - snapshot.cash - Math.max(0, snapshot.pendingRevenue));

  if (cashGap > 0 && snapshot.liquidInvestments > 0) {
    return { action: 'withdraw', amount: Math.min(cashGap, snapshot.liquidInvestments), reasons: ['cash is below protected operating target', 'liquid assets may be needed to restore reserves'] };
  }
  if (excessCash > snapshot.targetInvestmentCash) {
    return { action: 'deposit', amount: excessCash - snapshot.targetInvestmentCash, reasons: ['cash exceeds operating and protected requirements', 'excess liquidity may be deployable'] };
  }
  return { action: 'hold', amount: 0, reasons: ['liquidity is within configured safety bands'] };
}
