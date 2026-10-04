import {
  assertAffiliateNetworkObservation,
  normalizeAffiliateNetworkDate,
  normalizeAffiliateNetworkLimit,
  type AffiliateNetworkEconomicState,
  type AffiliateNetworkObservation,
  type AffiliateNetworkObservationAdapter,
  type AffiliateNetworkReadBatch,
  type AffiliateNetworkReadRequest,
} from "./affiliate-network";

export interface PartnerizeFetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<unknown>;
}

export type PartnerizeFetch = (
  input: string,
  init?: { headers?: Record<string, string> },
) => Promise<PartnerizeFetchResponse>;

export interface PartnerizePartnerReportingConfig {
  authorizationHeader: string;
  baseUrl?: string;
}

type RawPartnerizeClick = {
  campaign_id?: string | number;
  publisher_id?: string | number;
  set_time?: string;
  publisher_reference?: string;
  clickref?: string;
};

type RawPartnerizeClickEnvelope = {
  click?: RawPartnerizeClick;
};

type RawPartnerizeClickReport = {
  count?: number;
  limit?: number;
  offset?: number;
  clicks?: RawPartnerizeClickEnvelope[];
};

type RawPartnerizeConversionValue = {
  conversion_status?: string;
  publisher_commission?: number | string;
  value?: number | string;
};

type RawPartnerizeConversion = {
  conversion_id?: string | number;
  campaign_id?: string | number;
  publisher_id?: string | number;
  conversion_time?: string;
  currency?: string;
  publisher_reference?: string;
  customer_reference?: string;
  conversion_reference?: string;
  last_modified?: string;
  conversion_value?: RawPartnerizeConversionValue;
  payment_status?: string;
  was_disputed?: boolean;
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

export class PartnerizePartnerReportingAdapter
  implements AffiliateNetworkObservationAdapter
{
  readonly name = "partnerize";

  private readonly baseUrl: string;
  private readonly authorizationHeader: string;

  constructor(
    private readonly fetchImpl: PartnerizeFetch,
    config: PartnerizePartnerReportingConfig,
  ) {
    this.baseUrl = (config.baseUrl ?? "https://api.partnerize.com").replace(
      /\/$/,
      "",
    );
    this.authorizationHeader = config.authorizationHeader.trim();
    if (!/^Basic\s+\S+/i.test(this.authorizationHeader)) {
      throw new Error("Partnerize authorizationHeader must use HTTP Basic");
    }
  }

  async read(request: AffiliateNetworkReadRequest): Promise<AffiliateNetworkReadBatch> {
    const publisherId = requireText(request.accountRef, "Partnerize accountRef");
    const startAt = normalizeAffiliateNetworkDate(
      request.startAt ?? new Date(Date.now() - 86_400_000).toISOString(),
      "Partnerize startAt",
    );
    const endAt = request.endAt
      ? normalizeAffiliateNetworkDate(request.endAt, "Partnerize endAt")
      : undefined;
    const limit = normalizeAffiliateNetworkLimit(request.limit, 300, 100);
    const offset = parseOffset(request.cursor);

    const [clickReport, conversionReport] = await Promise.all([
      this.getJson<RawPartnerizeClickReport>(
        reportUrl(
          this.baseUrl,
          publisherId,
          "click",
          startAt,
          endAt,
          limit,
          offset,
          false,
        ),
      ),
      this.getJson<RawPartnerizeConversionReport>(
        reportUrl(
          this.baseUrl,
          publisherId,
          "conversion",
          startAt,
          endAt,
          limit,
          offset,
          true,
        ),
      ),
    ]);

    const observations = [
      ...(clickReport.clicks ?? []).flatMap((entry) => {
        const normalized = normalizePartnerizeClick(entry.click);
        return normalized ? [normalized] : [];
      }),
      ...(conversionReport.conversions ?? []).flatMap((entry) => {
        const normalized = normalizePartnerizeConversion(entry.conversion_data);
        return normalized ? [normalized] : [];
      }),
    ];

    const returned = Math.max(
      Number(clickReport.count ?? 0),
      Number(conversionReport.count ?? 0),
    );
    const effectiveLimit = Math.max(
      Number(clickReport.limit ?? limit),
      Number(conversionReport.limit ?? limit),
      limit,
    );
    const nextOffset = offset + effectiveLimit;
    const complete = returned < effectiveLimit;

    return {
      provider: "partnerize",
      accountRef: publisherId,
      observations,
      nextCursor: complete ? undefined : String(nextOffset),
      complete,
      readOnly: true,
    };
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
        `Partnerize API error: ${response.status} ${response.statusText}`,
      );
    }
    return (await response.json()) as T;
  }
}

export function normalizePartnerizeClick(
  click?: RawPartnerizeClick,
): AffiliateNetworkObservation | null {
  if (!click) return null;
  const clickref = textValue(click.clickref);
  const campaignId = textValue(click.campaign_id);
  const publisherId = textValue(click.publisher_id);
  const occurredAt = partnerizeUtcDate(click.set_time);
  if (!clickref || !campaignId || !publisherId || !occurredAt) return null;

  const observation: AffiliateNetworkObservation = {
    provider: "partnerize",
    accountRef: `partnerize:publisher:${publisherId}`,
    programRef: `partnerize:campaign:${campaignId}`,
    externalEventRef: `partnerize:click:${clickref}`,
    kind: "click",
    providerStatus: undefined,
    economicState: "unknown",
    customerOrSessionRef: cleanOptional(click.publisher_reference),
    occurredAt,
    evidenceRefs: [
      `partnerize:publisher:${publisherId}:click:${clickref}`,
    ],
    metadata: compact({
      clickref,
      campaign_id: campaignId,
      publisher_id: publisherId,
    }),
  };
  assertAffiliateNetworkObservation(observation);
  return observation;
}

export function normalizePartnerizeConversion(
  conversion?: RawPartnerizeConversion,
): AffiliateNetworkObservation | null {
  if (!conversion) return null;
  const conversionId = textValue(conversion.conversion_id);
  const campaignId = textValue(conversion.campaign_id);
  const publisherId = textValue(conversion.publisher_id);
  const occurredAt = partnerizeUtcDate(conversion.conversion_time);
  const commission = numberValue(
    conversion.conversion_value?.publisher_commission,
  );
  const currency = cleanOptional(conversion.currency)?.toUpperCase();
  if (
    !conversionId ||
    !campaignId ||
    !publisherId ||
    !occurredAt ||
    commission === undefined ||
    commission < 0 ||
    !currency
  ) {
    return null;
  }

  const providerStatus =
    cleanOptional(conversion.conversion_value?.conversion_status) ??
    cleanOptional(conversion.payment_status);
  const economicState = partnerizeEconomicState(providerStatus);

  const observation: AffiliateNetworkObservation = {
    provider: "partnerize",
    accountRef: `partnerize:publisher:${publisherId}`,
    programRef: `partnerize:campaign:${campaignId}`,
    externalEventRef: `partnerize:conversion:${conversionId}`,
    kind: "conversion",
    providerStatus,
    economicState,
    customerOrSessionRef:
      cleanOptional(conversion.customer_reference) ??
      cleanOptional(conversion.publisher_reference) ??
      cleanOptional(conversion.conversion_reference),
    amount: commission,
    currency,
    occurredAt,
    evidenceRefs: [
      `partnerize:publisher:${publisherId}:conversion:${conversionId}`,
    ],
    metadata: compact({
      conversion_reference: cleanOptional(conversion.conversion_reference),
      last_modified: cleanOptional(conversion.last_modified),
      payment_status: cleanOptional(conversion.payment_status),
      disputed:
        conversion.was_disputed === undefined
          ? undefined
          : String(conversion.was_disputed),
      conversion_value:
        conversion.conversion_value?.value === undefined
          ? undefined
          : String(conversion.conversion_value.value),
    }),
  };
  assertAffiliateNetworkObservation(observation);
  return observation;
}

function reportUrl(
  baseUrl: string,
  publisherId: string,
  report: "click" | "conversion",
  startAt: string,
  endAt: string | undefined,
  limit: number,
  offset: number,
  includePaymentInfo: boolean,
): string {
  const url = new URL(
    `/reporting/report_publisher/publisher/${encodeURIComponent(
      publisherId,
    )}/${report}.json`,
    baseUrl,
  );
  url.searchParams.set("start_date", startAt);
  if (endAt) url.searchParams.set("end_date", endAt);
  url.searchParams.set("timezone", "UTC");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  if (includePaymentInfo) url.searchParams.set("include_payment_info", "true");
  return url.toString();
}

function partnerizeEconomicState(
  status?: string,
): AffiliateNetworkEconomicState {
  switch (status?.trim().toLowerCase()) {
    case "pending":
      return "pending";
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
    case "paid":
    case "released":
      return "paid";
    default:
      return "unknown";
  }
}

function partnerizeUtcDate(value?: string): string | undefined {
  const cleaned = cleanOptional(value);
  if (!cleaned) return undefined;
  const normalized =
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(cleaned)
      ? cleaned.replace(" ", "T") + "Z"
      : cleaned;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

function parseOffset(value?: string): number {
  if (!value) return 0;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("Partnerize cursor must be a non-negative integer offset");
  }
  return parsed;
}

function requireText(value: string, field: string): string {
  if (!value.trim()) throw new Error(`${field} is required`);
  return value.trim();
}

function textValue(value: string | number | undefined): string | undefined {
  if (value === undefined || value === null) return undefined;
  const cleaned = String(value).trim();
  return cleaned || undefined;
}

function numberValue(value: number | string | undefined): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function cleanOptional(value?: string): string | undefined {
  const cleaned = value?.trim();
  return cleaned || undefined;
}

function compact(
  value: Record<string, string | undefined>,
): Record<string, string> | undefined {
  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] => entry[1] !== undefined,
  );
  return entries.length ? Object.fromEntries(entries) : undefined;
}
