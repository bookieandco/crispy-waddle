import {
  assertAffiliateNetworkObservation,
  normalizeAffiliateNetworkDate,
  normalizeAffiliateNetworkLimit,
  type AffiliateNetworkObservation,
  type AffiliateNetworkObservationAdapter,
  type AffiliateNetworkReadBatch,
  type AffiliateNetworkReadRequest,
} from "./affiliate-network";
import type { PartnerizeFetch } from "./affiliate-partnerize";

type RawPartnerizeConversionItem = {
  conversion_item_id?: string | number;
  item_publisher_commission?: number | string;
  item_status?: string;
  publisher_self_bill_id?: string | number | null;
};

type RawPartnerizeConversion = {
  conversion_id?: string | number;
  campaign_id?: string | number;
  publisher_id?: string | number;
  conversion_time?: string;
  currency?: string;
  customer_reference?: string;
  publisher_reference?: string;
  conversion_items?: RawPartnerizeConversionItem[];
};

type RawPartnerizeConversionEnvelope = {
  conversion_data?: RawPartnerizeConversion;
};

type RawPartnerizeConversionReport = {
  count?: number;
  limit?: number;
  offset?: number;
  conversions?: RawPartnerizeConversionEnvelope[];
};

type RawPartnerizeSelfbill = {
  publisher_self_bill_id?: string | number;
  publisher_id?: string | number;
  payment_date?: string | null;
  paid_currency?: string;
  selfbill_currency?: string;
  tracked_currency?: string;
  net_value?: number | string;
  total_value?: number | string;
  tracked_net_value?: number | string;
  vat_value?: number | string;
  withheld_tax?: number | string;
};

type RawPartnerizeSelfbillEnvelope = {
  selfbill?: RawPartnerizeSelfbill;
};

export type PartnerizeProgramPayoutAttributionConfig = {
  authorizationHeader: string;
  baseUrl?: string;
};

export class PartnerizeProgramPayoutAttributionAdapter
  implements AffiliateNetworkObservationAdapter
{
  readonly name = "partnerize";

  private readonly baseUrl: string;
  private readonly authorizationHeader: string;
  private readonly selfbillCache = new Map<
    string,
    Promise<RawPartnerizeSelfbill | undefined>
  >();

  constructor(
    private readonly fetchImpl: PartnerizeFetch,
    config: PartnerizeProgramPayoutAttributionConfig,
  ) {
    this.baseUrl = (config.baseUrl ?? "https://api.partnerize.com").replace(
      /\/$/,
      "",
    );
    this.authorizationHeader = config.authorizationHeader.trim();
    if (!/^Basic\s+\S+/i.test(this.authorizationHeader)) {
      throw new Error(
        "Partnerize payout attribution authorizationHeader must use HTTP Basic",
      );
    }
  }

  async read(
    request: AffiliateNetworkReadRequest,
  ): Promise<AffiliateNetworkReadBatch> {
    const publisherId = requireText(
      request.accountRef,
      "Partnerize payout attribution accountRef",
    );
    const startAt = normalizeAffiliateNetworkDate(
      request.startAt ?? new Date(Date.now() - 30 * 86_400_000).toISOString(),
      "Partnerize payout attribution startAt",
    );
    const endAt = request.endAt
      ? normalizeAffiliateNetworkDate(
          request.endAt,
          "Partnerize payout attribution endAt",
        )
      : undefined;
    const limit = normalizeAffiliateNetworkLimit(request.limit, 300, 100);
    const offset = parseOffset(request.cursor);

    const report = await this.getJson<RawPartnerizeConversionReport>(
      conversionUrl(
        this.baseUrl,
        publisherId,
        startAt,
        endAt,
        limit,
        offset,
      ),
    );

    const observations: AffiliateNetworkObservation[] = [];
    const warnings: string[] = [];

    for (const envelope of report.conversions ?? []) {
      const conversion = envelope.conversion_data;
      if (!conversion) continue;

      const conversionId = textValue(conversion.conversion_id);
      const campaignId = textValue(conversion.campaign_id);
      const conversionPublisherId = textValue(conversion.publisher_id);
      const conversionAt = partnerizeDate(conversion.conversion_time);
      const currency = cleanOptional(conversion.currency)?.toUpperCase();

      if (
        !conversionId ||
        !campaignId ||
        !conversionPublisherId ||
        conversionPublisherId !== publisherId ||
        !conversionAt ||
        !currency
      ) {
        warnings.push("partnerize_payout:conversion_identity_incomplete");
        continue;
      }

      for (const item of conversion.conversion_items ?? []) {
        const itemId = textValue(item.conversion_item_id);
        const selfbillId = textValue(item.publisher_self_bill_id ?? undefined);
        const commission = numberValue(item.item_publisher_commission);
        const itemStatus = cleanOptional(item.item_status)?.toLowerCase();

        if (!itemId || !selfbillId || commission === undefined || commission <= 0) {
          continue;
        }
        if (itemStatus !== "approved") {
          warnings.push(
            `partnerize_payout:item_not_approved:${stableWarningRef(
              conversionId,
              itemId,
            )}`,
          );
          continue;
        }

        const selfbill = await this.getSelfbill(publisherId, selfbillId);
        const admission = admitPaidSelfbill({
          selfbill,
          publisherId,
          selfbillId,
          currency,
        });
        if (!admission.ok) {
          warnings.push(
            `partnerize_payout:${admission.reason}:${stableWarningRef(
              conversionId,
              itemId,
            )}`,
          );
          continue;
        }

        const observation: AffiliateNetworkObservation = {
          provider: "partnerize",
          accountRef: publisherId,
          programRef: `partnerize:campaign:${campaignId}`,
          externalEventRef:
            `partnerize:selfbill:${selfbillId}:item:${itemId}`,
          kind: "payout",
          providerStatus: "paid_selfbill_item",
          economicState: "paid",
          customerOrSessionRef:
            cleanOptional(conversion.customer_reference) ??
            cleanOptional(conversion.publisher_reference),
          amount: roundMoney(commission),
          currency,
          occurredAt: admission.paymentAt,
          evidenceRefs: [
            `partnerize:publisher:${publisherId}:conversion:${conversionId}`,
            `partnerize:publisher:${publisherId}:conversion:${conversionId}:item:${itemId}`,
            `partnerize:publisher:${publisherId}:selfbill:${selfbillId}`,
          ],
          metadata: {
            conversion_id: conversionId,
            conversion_item_id: itemId,
            conversion_at: conversionAt,
            selfbill_id: selfbillId,
            selfbill_payment_at: admission.paymentAt,
            settlement_currency: currency,
            settlement_basis: "paid_selfbill_item_no_fx_no_tax",
          },
        };
        assertAffiliateNetworkObservation(observation);
        observations.push(observation);
      }
    }

    const totalCount = Math.max(0, Number(report.count ?? 0));
    const effectiveLimit = Math.max(
      1,
      Number(report.limit ?? limit),
      limit,
    );
    const nextOffset = offset + effectiveLimit;
    const complete = nextOffset >= totalCount;

    return {
      provider: "partnerize",
      accountRef: publisherId,
      observations,
      nextCursor: complete ? undefined : String(nextOffset),
      complete,
      warnings: [...new Set(warnings)],
      readOnly: true,
    };
  }

  private getSelfbill(
    publisherId: string,
    selfbillId: string,
  ): Promise<RawPartnerizeSelfbill | undefined> {
    const key = `${publisherId}:${selfbillId}`;
    const cached = this.selfbillCache.get(key);
    if (cached) return cached;

    const pending = this.getJson<RawPartnerizeSelfbillEnvelope>(
      new URL(
        `/user/publisher/${encodeURIComponent(
          publisherId,
        )}/selfbill/${encodeURIComponent(selfbillId)}`,
        this.baseUrl,
      ).toString(),
    ).then((body) => body.selfbill);

    this.selfbillCache.set(key, pending);
    return pending;
  }

  private async getJson<T>(url: string): Promise<T> {
    const response = await this.fetchImpl(url, {
      headers: {
        Authorization: this.authorizationHeader,
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(
        `Partnerize payout attribution API error: ${response.status} ${response.statusText}`,
      );
    }
    return (await response.json()) as T;
  }
}

type PaidSelfbillAdmission =
  | { ok: true; paymentAt: string }
  | {
      ok: false;
      reason:
        | "selfbill_missing"
        | "selfbill_identity_mismatch"
        | "selfbill_unpaid"
        | "selfbill_currency_ambiguous"
        | "selfbill_tax_ambiguous"
        | "selfbill_value_ambiguous";
    };

function admitPaidSelfbill(input: {
  selfbill?: RawPartnerizeSelfbill;
  publisherId: string;
  selfbillId: string;
  currency: string;
}): PaidSelfbillAdmission {
  const selfbill = input.selfbill;
  if (!selfbill) return { ok: false, reason: "selfbill_missing" };

  const publisherId = textValue(selfbill.publisher_id);
  const selfbillId = textValue(selfbill.publisher_self_bill_id);
  if (
    publisherId !== input.publisherId ||
    selfbillId !== input.selfbillId
  ) {
    return { ok: false, reason: "selfbill_identity_mismatch" };
  }

  const paymentAt = partnerizeDate(selfbill.payment_date ?? undefined);
  if (!paymentAt) return { ok: false, reason: "selfbill_unpaid" };

  const paidCurrency = cleanOptional(selfbill.paid_currency)?.toUpperCase();
  const invoiceCurrency =
    cleanOptional(selfbill.selfbill_currency)?.toUpperCase();
  const trackedCurrency =
    cleanOptional(selfbill.tracked_currency)?.toUpperCase();
  if (
    paidCurrency !== input.currency ||
    invoiceCurrency !== input.currency ||
    trackedCurrency !== input.currency
  ) {
    return { ok: false, reason: "selfbill_currency_ambiguous" };
  }

  const vat = numberValue(selfbill.vat_value);
  const withheldTax = numberValue(selfbill.withheld_tax);
  if (vat !== 0 || withheldTax !== 0) {
    return { ok: false, reason: "selfbill_tax_ambiguous" };
  }

  const net = numberValue(selfbill.net_value);
  const total = numberValue(selfbill.total_value);
  const trackedNet = numberValue(selfbill.tracked_net_value);
  if (
    net === undefined ||
    total === undefined ||
    trackedNet === undefined ||
    !moneyEqual(net, total) ||
    !moneyEqual(net, trackedNet)
  ) {
    return { ok: false, reason: "selfbill_value_ambiguous" };
  }

  return { ok: true, paymentAt };
}

function conversionUrl(
  baseUrl: string,
  publisherId: string,
  startAt: string,
  endAt: string | undefined,
  limit: number,
  offset: number,
): string {
  const url = new URL(
    `/reporting/report_publisher/publisher/${encodeURIComponent(
      publisherId,
    )}/conversion.json`,
    baseUrl,
  );
  url.searchParams.set("start_date", startAt);
  if (endAt) url.searchParams.set("end_date", endAt);
  url.searchParams.set("timezone", "UTC");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  url.searchParams.append("statuses[]", "approved");
  url.searchParams.set("include_payment_info", "true");
  return url.toString();
}

function parseOffset(value?: string): number {
  if (!value) return 0;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(
      "Partnerize payout attribution cursor must be a non-negative integer offset",
    );
  }
  return parsed;
}

function partnerizeDate(value?: string): string | undefined {
  const cleaned = cleanOptional(value);
  if (!cleaned) return undefined;
  const normalized =
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(cleaned)
      ? cleaned.replace(" ", "T") + "Z"
      : cleaned;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed)
    ? new Date(parsed).toISOString()
    : undefined;
}

function stableWarningRef(conversionId: string, itemId: string): string {
  return `${conversionId.slice(-8)}:${itemId.slice(-8)}`;
}

function requireText(value: string, field: string): string {
  if (!value.trim()) throw new Error(`${field} is required`);
  return value.trim();
}

function textValue(
  value: string | number | null | undefined,
): string | undefined {
  if (value === undefined || value === null) return undefined;
  const cleaned = String(value).trim();
  return cleaned || undefined;
}

function numberValue(
  value: number | string | undefined,
): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function cleanOptional(value?: string): string | undefined {
  const cleaned = value?.trim();
  return cleaned || undefined;
}

function moneyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= 0.01;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
