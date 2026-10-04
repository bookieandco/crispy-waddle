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
  const pending = normalizeMoneyMap(summary?.pending);
  const approved = normalizeMoneyMap(summary?.approved);
  const confirmed = normalizeMoneyMap(summary?.confirmed);
  const available = normalizeMoneyMap(summary?.available);
  const paid = normalizeMoneyMap(summary?.paid);
  const currencies = new Set<string>([
    ...pending.keys(),
    ...approved.keys(),
    ...confirmed.keys(),
    ...available.keys(),
    ...paid.keys(),
  ]);

  return [...currencies]
    .filter(Boolean)
    .sort()
    .map((currency) => ({
      currency,
      pending: pending.get(currency) ?? 0,
      approved: approved.get(currency) ?? 0,
      confirmed: confirmed.get(currency) ?? 0,
      available: available.get(currency) ?? 0,
      paid: paid.get(currency) ?? 0,
    }));
}

function normalizeMoneyMap(value?: RawMoneyMap): Map<string, number> {
  const output = new Map<string, number>();
  for (const [rawCurrency, rawValue] of Object.entries(value ?? {})) {
    const currency = rawCurrency.trim().toUpperCase();
    if (!currency) continue;
    output.set(currency, moneyValue(rawValue));
  }
  return output;
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
