import {
  assertAffiliatePayoutSnapshot,
  type AffiliatePayoutBalance,
  type AffiliatePayoutBalanceAdapter,
  type AffiliatePayoutBalanceSnapshot,
  type AffiliatePayoutSnapshotRequest,
} from "./affiliate-payout";
import type { PartnerizeFetch } from "./affiliate-partnerize";

type RawMoneyMap = Record<string, number | string | undefined>;

type RawPartnerizePaymentSummary = {
  summary?: {
    pending?: RawMoneyMap;
    approved?: RawMoneyMap;
    confirmed?: RawMoneyMap;
    available?: RawMoneyMap;
    paid?: RawMoneyMap;
  };
};

export interface PartnerizePaymentSummaryConfig {
  authorizationHeader: string;
  baseUrl?: string;
}

export class PartnerizePaymentSummaryAdapter
  implements AffiliatePayoutBalanceAdapter
{
  readonly name = "partnerize";

  private readonly baseUrl: string;
  private readonly authorizationHeader: string;

  constructor(
    private readonly fetchImpl: PartnerizeFetch,
    config: PartnerizePaymentSummaryConfig,
  ) {
    this.baseUrl = (config.baseUrl ?? "https://api.partnerize.com").replace(/\/$/, "");
    this.authorizationHeader = config.authorizationHeader.trim();
    if (!/^Basic\s+\S+/i.test(this.authorizationHeader)) {
      throw new Error("Partnerize authorizationHeader must use HTTP Basic");
    }
  }

  async readPayoutBalances(
    request: AffiliatePayoutSnapshotRequest,
  ): Promise<AffiliatePayoutBalanceSnapshot> {
    const publisherId = requireText(request.accountRef, "Partnerize payout accountRef");
    const url = new URL(
      `/user/publisher/${encodeURIComponent(publisherId)}/payment/summary`,
      this.baseUrl,
    ).toString();
    const response = await this.fetchImpl(url, {
      headers: {
        Authorization: this.authorizationHeader,
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(
        `Partnerize payment summary error: ${response.status} ${response.statusText}`,
      );
    }

    const body = (await response.json()) as RawPartnerizePaymentSummary;
    const snapshot: AffiliatePayoutBalanceSnapshot = {
      provider: "partnerize",
      accountRef: publisherId,
      balances: normalizeSummary(body.summary),
      observedAt: normalizeObservedAt(request.observedAt),
      evidenceRefs: [`partnerize:publisher:${publisherId}:payment-summary`],
      sourceSemantics: "CUMULATIVE_PROVIDER_BALANCES",
      readOnly: true,
      externalActionAuthorized: false,
      paymentAuthorized: false,
      moneyMovementAuthorized: false,
    };
    assertAffiliatePayoutSnapshot(snapshot);
    return snapshot;
  }
}

function normalizeSummary(
  summary?: RawPartnerizePaymentSummary["summary"],
): AffiliatePayoutBalance[] {
  const currencies = new Set<string>();
  for (const map of [
    summary?.pending,
    summary?.approved,
    summary?.confirmed,
    summary?.available,
    summary?.paid,
  ]) {
    for (const key of Object.keys(map ?? {})) currencies.add(key.trim().toUpperCase());
  }

  return [...currencies]
    .filter(Boolean)
    .sort()
    .map((currency) => ({
      currency,
      pending: moneyValue(summary?.pending?.[currency]),
      approved: moneyValue(summary?.approved?.[currency]),
      confirmed: moneyValue(summary?.confirmed?.[currency]),
      available: moneyValue(summary?.available?.[currency]),
      paid: moneyValue(summary?.paid?.[currency]),
    }));
}

function moneyValue(value: number | string | undefined): number {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Partnerize payment summary contains invalid money");
  }
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

function normalizeObservedAt(value?: string): string {
  const candidate = value ?? new Date().toISOString();
  const parsed = Date.parse(candidate);
  if (!Number.isFinite(parsed)) throw new Error("Partnerize payout observedAt is invalid");
  return new Date(parsed).toISOString();
}

function requireText(value: string, field: string): string {
  if (!value.trim()) throw new Error(`${field} is required`);
  return value.trim();
}
