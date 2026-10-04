export type AffiliatePayoutBalance = {
  currency: string;
  pending: number;
  approved: number;
  confirmed: number;
  available: number;
  paid: number;
};

export type AffiliatePayoutBalanceSnapshot = {
  provider: string;
  accountRef: string;
  balances: AffiliatePayoutBalance[];
  observedAt: string;
  evidenceRefs: string[];
  sourceSemantics: "CUMULATIVE_PROVIDER_BALANCES";
  readOnly: true;
  externalActionAuthorized: false;
  paymentAuthorized: false;
  moneyMovementAuthorized: false;
};

export type AffiliatePayoutSnapshotRequest = {
  accountRef: string;
  observedAt?: string;
};

export interface AffiliatePayoutBalanceAdapter {
  readonly name: string;
  readPayoutBalances(
    request: AffiliatePayoutSnapshotRequest,
  ): Promise<AffiliatePayoutBalanceSnapshot>;
}

export type AffiliatePayoutPaidHighWater = Record<string, number>;

export type AffiliatePayoutCurrencyDelta = {
  currency: string;
  previousPaid?: number;
  highWaterPaid: number;
  currentPaid: number;
  realizedPayoutDelta: number;
  status:
    | "baseline"
    | "unchanged"
    | "increased"
    | "regressed"
    | "recovered";
  anomaly?: "CUMULATIVE_PAID_BALANCE_BELOW_HIGH_WATER";
};

export type AffiliatePayoutReconciliation = {
  provider: string;
  accountRef: string;
  previousObservedAt?: string;
  currentObservedAt: string;
  baselineRequired: boolean;
  currencies: AffiliatePayoutCurrencyDelta[];
  hasNewPayoutEvidence: boolean;
  hasBalanceRegression: boolean;
  programAttributionAvailable: false;
  revenueRecognition: "POSITIVE_PAID_BALANCE_DELTA_ONLY";
  authority: "AFFILIATE_PAYOUT_RECONCILIATION_ONLY";
  externalActionAuthorized: false;
  paymentAuthorized: false;
  moneyMovementAuthorized: false;
};

export function reconcileAffiliatePayoutBalances(
  previous: AffiliatePayoutBalanceSnapshot | undefined,
  current: AffiliatePayoutBalanceSnapshot,
  previousHighWater?: AffiliatePayoutPaidHighWater,
): AffiliatePayoutReconciliation {
  assertAffiliatePayoutSnapshot(current);
  if (previous) {
    assertAffiliatePayoutSnapshot(previous);
    if (
      previous.provider !== current.provider ||
      previous.accountRef !== current.accountRef
    ) {
      throw new Error("Affiliate payout snapshots must share provider and account");
    }
    if (Date.parse(current.observedAt) < Date.parse(previous.observedAt)) {
      throw new Error("Affiliate payout snapshots must be chronological");
    }
  }

  const previousPaid = new Map(
    previous?.balances.map((balance) => [
      balance.currency.trim().toUpperCase(),
      balance.paid,
    ]) ?? [],
  );
  const suppliedHighWater = new Map(
    Object.entries(previousHighWater ?? {}).map(([currency, value]) => [
      currency.trim().toUpperCase(),
      value,
    ]),
  );
  for (const [currency, value] of suppliedHighWater) {
    if (!currency || !Number.isFinite(value) || value < 0) {
      throw new Error("Affiliate payout high-water mark is invalid");
    }
  }
  const currentPaid = new Map(
    current.balances.map((balance) => [
      balance.currency.trim().toUpperCase(),
      balance.paid,
    ]),
  );
  const currencies = [...new Set([
    ...previousPaid.keys(),
    ...suppliedHighWater.keys(),
    ...currentPaid.keys(),
  ])].sort();

  const deltas = currencies.map((currency): AffiliatePayoutCurrencyDelta => {
    const before = previousPaid.get(currency);
    const after = currentPaid.get(currency) ?? 0;
    const hasPriorCurrency =
      previousPaid.has(currency) || suppliedHighWater.has(currency);
    const priorHighWater = suppliedHighWater.get(currency) ?? before ?? 0;

    if (!previous || !hasPriorCurrency) {
      return {
        currency,
        highWaterPaid: money(after),
        currentPaid: money(after),
        realizedPayoutDelta: 0,
        status: "baseline",
      };
    }

    if (after < priorHighWater) {
      return {
        currency,
        previousPaid: money(before ?? 0),
        highWaterPaid: money(priorHighWater),
        currentPaid: money(after),
        realizedPayoutDelta: 0,
        status: "regressed",
        anomaly: "CUMULATIVE_PAID_BALANCE_BELOW_HIGH_WATER",
      };
    }

    if (after === priorHighWater) {
      return {
        currency,
        previousPaid: money(before ?? 0),
        highWaterPaid: money(priorHighWater),
        currentPaid: money(after),
        realizedPayoutDelta: 0,
        status:
          before !== undefined && before < priorHighWater
            ? "recovered"
            : "unchanged",
      };
    }

    const delta = money(after - priorHighWater);
    return {
      currency,
      previousPaid: money(before ?? 0),
      highWaterPaid: money(after),
      currentPaid: money(after),
      realizedPayoutDelta: delta,
      status: "increased",
    };
  });

  return {
    provider: current.provider,
    accountRef: current.accountRef,
    previousObservedAt: previous?.observedAt,
    currentObservedAt: current.observedAt,
    baselineRequired: !previous,
    currencies: deltas,
    hasNewPayoutEvidence: deltas.some((delta) => delta.realizedPayoutDelta > 0),
    hasBalanceRegression: deltas.some((delta) => delta.status === "regressed"),
    programAttributionAvailable: false,
    revenueRecognition: "POSITIVE_PAID_BALANCE_DELTA_ONLY",
    authority: "AFFILIATE_PAYOUT_RECONCILIATION_ONLY",
    externalActionAuthorized: false,
    paymentAuthorized: false,
    moneyMovementAuthorized: false,
  };
}

export function assertAffiliatePayoutSnapshot(
  snapshot: AffiliatePayoutBalanceSnapshot,
): void {
  if (!snapshot.provider.trim()) throw new Error("Affiliate payout provider is required");
  if (!snapshot.accountRef.trim()) throw new Error("Affiliate payout accountRef is required");
  if (!Number.isFinite(Date.parse(snapshot.observedAt))) {
    throw new Error("Affiliate payout observedAt is invalid");
  }
  if (!snapshot.evidenceRefs.length || snapshot.evidenceRefs.some((ref) => !ref.trim())) {
    throw new Error("Affiliate payout snapshot requires evidence");
  }

  const currencies = new Set<string>();
  for (const balance of snapshot.balances) {
    const currency = balance.currency.trim().toUpperCase();
    if (!currency) throw new Error("Affiliate payout currency is required");
    if (currencies.has(currency)) {
      throw new Error(`Duplicate affiliate payout currency: ${currency}`);
    }
    currencies.add(currency);
    for (const [field, value] of Object.entries({
      pending: balance.pending,
      approved: balance.approved,
      confirmed: balance.confirmed,
      available: balance.available,
      paid: balance.paid,
    })) {
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`Affiliate payout ${field} must be finite and non-negative`);
      }
    }
  }
}

export function affiliatePayoutHighWaterFromReconciliation(
  reconciliation: AffiliatePayoutReconciliation,
): AffiliatePayoutPaidHighWater {
  return Object.fromEntries(
    reconciliation.currencies.map((delta) => [
      delta.currency,
      money(Math.max(delta.highWaterPaid, delta.currentPaid)),
    ]),
  );
}

export function affiliatePayoutBalancesEqual(
  left: AffiliatePayoutBalanceSnapshot,
  right: AffiliatePayoutBalanceSnapshot,
): boolean {
  if (left.provider !== right.provider || left.accountRef !== right.accountRef) return false;
  return JSON.stringify(canonicalBalances(left.balances)) ===
    JSON.stringify(canonicalBalances(right.balances));
}

function canonicalBalances(balances: AffiliatePayoutBalance[]) {
  return balances
    .map((balance) => ({
      currency: balance.currency.trim().toUpperCase(),
      pending: money(balance.pending),
      approved: money(balance.approved),
      confirmed: money(balance.confirmed),
      available: money(balance.available),
      paid: money(balance.paid),
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
