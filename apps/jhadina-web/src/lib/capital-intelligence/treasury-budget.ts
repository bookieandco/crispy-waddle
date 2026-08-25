export type TreasuryBudget = {
  cash: number;
  survivalReserve: number;
  taxReserve: number;
  operatingReserve: number;
  adBudget: number;
  infrastructureBudget: number;
  otherOsBudget: number;
};

export type TreasuryPlan = TreasuryBudget & {
  protectedCash: number;
  discretionaryCash: number;
  spendableAdBudget: number;
  spendableOsBudget: number;
};

/** Recommendation-only treasury planning. Never moves or spends funds. */
export function planTreasuryBudget(input: TreasuryBudget): TreasuryPlan {
  const protectedCash = Math.max(0, input.survivalReserve)
    + Math.max(0, input.taxReserve)
    + Math.max(0, input.operatingReserve);
  const discretionaryCash = Math.max(0, input.cash - protectedCash);
  const spendableAdBudget = Math.min(Math.max(0, input.adBudget), discretionaryCash);
  const spendableOsBudget = Math.min(
    Math.max(0, input.infrastructureBudget) + Math.max(0, input.otherOsBudget),
    Math.max(0, discretionaryCash - spendableAdBudget),
  );

  return {
    ...input,
    protectedCash,
    discretionaryCash,
    spendableAdBudget,
    spendableOsBudget,
  };
}
