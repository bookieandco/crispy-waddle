import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  TikTokPodSettlementObservation,
} from "@jhadina/opportunity-core";
import type {
  TikTokOrderStatementSnapshot,
  TikTokShopLiveClient,
} from "./tiktok-shop-live-client";

export type TikTokSellerRefundEvidence = {
  id: string;
  opportunityId: string;
  orderRef: string;
  refundRef: string;
  amount: number;
  currency: string;
  sourceRef: string;
  evidenceRefs: readonly string[];
  occurredAt: string;
  alreadyIncludedInStatementRevenue: boolean;
};

type SellerFinanceRow = {
  payload: TikTokPodSettlementObservation;
};

export class TikTokSellerFinanceRepository {
  constructor(private readonly client: SupabaseClient) {}

  async upsert(
    ownerUserId: string,
    observations: readonly TikTokPodSettlementObservation[],
  ): Promise<number> {
    const owner = requireText(ownerUserId, "TIKTOK_SELLER_FINANCE_OWNER_REQUIRED");
    if (!observations.length) return 0;
    const rows = observations.map((observation) => ({
      owner_user_id: owner,
      id: observation.id,
      opportunity_id: observation.opportunityId,
      order_ref: observation.orderRef ?? null,
      transaction_ref: observation.externalTransactionRef,
      kind: observation.kind,
      currency: observation.currency,
      amount: observation.amount,
      accounting_effect: observation.accountingEffect ?? "include",
      evidence_refs: observation.evidenceRefs,
      payload: observation,
      occurred_at: observation.occurredAt,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await this.client
      .from("jhadina_tiktok_seller_finance_observations")
      .upsert(rows, { onConflict: "owner_user_id,id" });
    if (error) {
      throw new Error(`TIKTOK_SELLER_FINANCE_SAVE_FAILED:${error.message}`);
    }
    return rows.length;
  }

  async list(
    ownerUserId: string,
    opportunityId: string,
  ): Promise<TikTokPodSettlementObservation[]> {
    const owner = requireText(ownerUserId, "TIKTOK_SELLER_FINANCE_OWNER_REQUIRED");
    const opportunity = requireText(
      opportunityId,
      "TIKTOK_SELLER_FINANCE_OPPORTUNITY_REQUIRED",
    );
    const { data, error } = await this.client
      .from("jhadina_tiktok_seller_finance_observations")
      .select("payload")
      .eq("owner_user_id", owner)
      .eq("opportunity_id", opportunity)
      .order("occurred_at", { ascending: true })
      .returns<SellerFinanceRow[]>();
    if (error) {
      throw new Error(`TIKTOK_SELLER_FINANCE_READ_FAILED:${error.message}`);
    }
    return (data ?? []).map((row) => row.payload);
  }
}

export function mapTikTokOrderStatementToSettlements(input: {
  opportunityId: string;
  statement: TikTokOrderStatementSnapshot;
  observedAt: string;
  evidenceRefs: readonly string[];
}): TikTokPodSettlementObservation[] {
  const opportunityId = requireText(
    input.opportunityId,
    "TIKTOK_SELLER_FINANCE_OPPORTUNITY_REQUIRED",
  );
  requireDate(input.observedAt, "TIKTOK_SELLER_FINANCE_OBSERVED_AT_INVALID");
  const currency = requireCurrency(input.statement.currency);
  const output: TikTokPodSettlementObservation[] = [];
  const sourceRef = `tiktok:order-statement:${input.statement.orderId}`;

  const revenue = signedMoney(input.statement.revenueAmount);
  if (revenue !== undefined && revenue !== 0) {
    output.push(settlement({
      id: `tiktok-finance:${input.statement.orderId}:revenue`,
      opportunityId,
      externalTransactionRef: `${sourceRef}:revenue`,
      orderRef: input.statement.orderId,
      kind: revenue > 0 ? "sale_settlement" : "refund",
      amount: Math.abs(revenue),
      currency,
      sourceRef,
      evidenceRefs: input.evidenceRefs,
      occurredAt: input.observedAt,
      accountingEffect: "include",
    }));
  }

  const feeAndTax = signedMoney(input.statement.feeAndTaxAmount);
  if (feeAndTax !== undefined && feeAndTax !== 0) {
    output.push(settlement({
      id: `tiktok-finance:${input.statement.orderId}:fee-tax`,
      opportunityId,
      externalTransactionRef: `${sourceRef}:fee-tax`,
      orderRef: input.statement.orderId,
      kind: "fee_and_tax",
      amount: Math.abs(feeAndTax),
      currency,
      sourceRef,
      evidenceRefs: input.evidenceRefs,
      occurredAt: input.observedAt,
      accountingEffect: "include",
    }));
  }

  const shipping = signedMoney(input.statement.shippingCostAmount);
  if (shipping !== undefined && shipping !== 0) {
    output.push(settlement({
      id: `tiktok-finance:${input.statement.orderId}:shipping`,
      opportunityId,
      externalTransactionRef: `${sourceRef}:shipping`,
      orderRef: input.statement.orderId,
      kind: "platform_shipping_cost",
      amount: Math.abs(shipping),
      currency,
      sourceRef,
      evidenceRefs: input.evidenceRefs,
      occurredAt: input.observedAt,
      accountingEffect: "include",
    }));
  }

  return output;
}

export function mapTikTokRefundEvidence(
  refund: TikTokSellerRefundEvidence,
): TikTokPodSettlementObservation {
  requireText(refund.id, "TIKTOK_SELLER_REFUND_ID_REQUIRED");
  requireText(refund.opportunityId, "TIKTOK_SELLER_REFUND_OPPORTUNITY_REQUIRED");
  requireText(refund.orderRef, "TIKTOK_SELLER_REFUND_ORDER_REQUIRED");
  requireText(refund.refundRef, "TIKTOK_SELLER_REFUND_REF_REQUIRED");
  requireText(refund.sourceRef, "TIKTOK_SELLER_REFUND_SOURCE_REQUIRED");
  requireDate(refund.occurredAt, "TIKTOK_SELLER_REFUND_DATE_INVALID");
  if (!Number.isFinite(refund.amount) || refund.amount <= 0) {
    throw new Error("TIKTOK_SELLER_REFUND_AMOUNT_INVALID");
  }
  if (!refund.evidenceRefs.length) {
    throw new Error("TIKTOK_SELLER_REFUND_EVIDENCE_REQUIRED");
  }
  return settlement({
    id: refund.id,
    opportunityId: refund.opportunityId,
    externalTransactionRef: refund.refundRef,
    orderRef: refund.orderRef,
    kind: "refund",
    amount: refund.amount,
    currency: requireCurrency(refund.currency),
    sourceRef: refund.sourceRef,
    evidenceRefs: refund.evidenceRefs,
    occurredAt: refund.occurredAt,
    accountingEffect: refund.alreadyIncludedInStatementRevenue
      ? "informational"
      : "include",
  });
}

export async function ingestTikTokSellerOrderFinance(input: {
  ownerUserId: string;
  opportunityId: string;
  orderId: string;
  client: Pick<TikTokShopLiveClient, "getOrderStatementTransactions">;
  repository: Pick<TikTokSellerFinanceRepository, "upsert">;
  observedAt?: string;
}): Promise<{
  observations: readonly TikTokPodSettlementObservation[];
  persisted: number;
  externalActionAuthorized: false;
  moneyMovementAuthorized: false;
}> {
  const observedAt = input.observedAt ?? new Date().toISOString();
  const statement = await input.client.getOrderStatementTransactions(
    input.orderId,
    new Date(observedAt),
  );
  const sourceRef = `tiktok:order-statement:${statement.orderId}`;
  const observations = mapTikTokOrderStatementToSettlements({
    opportunityId: input.opportunityId,
    statement,
    observedAt,
    evidenceRefs: [sourceRef],
  });
  const persisted = await input.repository.upsert(
    input.ownerUserId,
    observations,
  );
  return Object.freeze({
    observations: Object.freeze(observations),
    persisted,
    externalActionAuthorized: false as const,
    moneyMovementAuthorized: false as const,
  });
}

function settlement(
  observation: TikTokPodSettlementObservation,
): TikTokPodSettlementObservation {
  if (!observation.evidenceRefs.length) {
    throw new Error("TIKTOK_SELLER_FINANCE_EVIDENCE_REQUIRED");
  }
  return Object.freeze({
    ...observation,
    evidenceRefs: [...new Set([
      ...observation.evidenceRefs,
      observation.sourceRef,
    ])],
  });
}

function signedMoney(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("TIKTOK_SELLER_FINANCE_MONEY_INVALID");
  }
  return Math.round(parsed * 100) / 100;
}

function requireCurrency(value: string): string {
  const currency = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("TIKTOK_SELLER_FINANCE_CURRENCY_INVALID");
  }
  return currency;
}

function requireText(value: string, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function requireDate(value: string, code: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(code);
}
