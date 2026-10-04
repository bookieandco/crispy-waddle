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

export interface CjFetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<unknown>;
}

export type CjFetch = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<CjFetchResponse>;

export interface CjCommissionConfig {
  personalAccessToken: string;
  endpoint?: string;
}

type RawCjPublisherCommission = {
  commissionId?: string;
  advertiserId?: string;
  advertiserName?: string;
  publisherId?: string;
  orderId?: string | null;
  shopperId?: string | null;
  actionStatus?: string;
  actionType?: string;
  validationStatus?: string | null;
  original?: boolean;
  originalActionId?: string;
  correctionReason?: string | null;
  postingDate?: string;
  eventDate?: string;
  pubCommissionAmountUsd?: string | number;
};

type RawCjPublisherCommissions = {
  count?: number;
  limit?: number;
  maxCommissionId?: string | null;
  payloadComplete?: boolean;
  records?: RawCjPublisherCommission[];
};

type RawCjGraphQlResponse = {
  data?: {
    publisherCommissions?: RawCjPublisherCommissions;
  };
  errors?: Array<{ message?: string }>;
};

const PUBLISHER_COMMISSIONS_QUERY = `
query JhadinaPublisherCommissions(
  $publishers: [String!]!,
  $sincePostingDate: String,
  $beforePostingDate: String,
  $sinceCommissionId: String
) {
  publisherCommissions(
    forPublishers: $publishers,
    sincePostingDate: $sincePostingDate,
    beforePostingDate: $beforePostingDate,
    sinceCommissionId: $sinceCommissionId
  ) {
    count
    limit
    maxCommissionId
    payloadComplete
    records {
      commissionId
      advertiserId
      advertiserName
      publisherId
      orderId
      shopperId
      actionStatus
      actionType
      validationStatus
      original
      originalActionId
      correctionReason
      postingDate
      eventDate
      pubCommissionAmountUsd
    }
  }
}
`;

export class CjPublisherCommissionAdapter
  implements AffiliateNetworkObservationAdapter
{
  readonly name = "cj-affiliate";

  private readonly token: string;
  private readonly endpoint: string;

  constructor(
    private readonly fetchImpl: CjFetch,
    config: CjCommissionConfig,
  ) {
    this.token = config.personalAccessToken.trim();
    if (!this.token) throw new Error("CJ personal access token is required");
    this.endpoint = config.endpoint ?? "https://commissions.api.cj.com/query";
  }

  async read(request: AffiliateNetworkReadRequest): Promise<AffiliateNetworkReadBatch> {
    const publisherId = requireText(request.accountRef, "CJ accountRef");
    const limit = normalizeAffiliateNetworkLimit(request.limit, 100, 100);
    const startAt = request.startAt
      ? normalizeAffiliateNetworkDate(request.startAt, "CJ startAt")
      : undefined;
    const endAt = request.endAt
      ? normalizeAffiliateNetworkDate(request.endAt, "CJ endAt")
      : undefined;

    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query: PUBLISHER_COMMISSIONS_QUERY,
        variables: {
          publishers: [publisherId],
          sincePostingDate: startAt,
          beforePostingDate: endAt,
          sinceCommissionId: cleanOptional(request.cursor),
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`CJ API error: ${response.status} ${response.statusText}`);
    }

    const body = (await response.json()) as RawCjGraphQlResponse;
    if (body.errors?.length) {
      throw new Error(
        `CJ GraphQL error: ${body.errors
          .map((error) => error.message?.trim())
          .filter(Boolean)
          .join(" | ")}`,
      );
    }

    const result = body.data?.publisherCommissions;
    if (!result) throw new Error("CJ commission response is malformed");

    const observations = (result.records ?? [])
      .slice(0, limit)
      .flatMap((record) => {
        const normalized = normalizeCjPublisherCommission(record);
        return normalized ? [normalized] : [];
      });

    const complete = result.payloadComplete !== false;

    return {
      provider: "cj-affiliate",
      accountRef: publisherId,
      observations,
      nextCursor:
        complete || !result.maxCommissionId
          ? undefined
          : result.maxCommissionId,
      complete,
      readOnly: true,
    };
  }
}

export function normalizeCjPublisherCommission(
  record: RawCjPublisherCommission,
): AffiliateNetworkObservation | null {
  const commissionId = cleanOptional(record.commissionId);
  const advertiserId = cleanOptional(record.advertiserId);
  const publisherId = cleanOptional(record.publisherId);
  const occurredAt = cjDate(record.eventDate ?? record.postingDate);
  const rawAmount = numberValue(record.pubCommissionAmountUsd);

  if (
    !commissionId ||
    !advertiserId ||
    !publisherId ||
    !occurredAt ||
    rawAmount === undefined
  ) {
    return null;
  }

  const isCorrection = record.original === false;
  const isNegativeCorrection = isCorrection && rawAmount < 0;
  const isDeclinedCorrection =
    isCorrection && record.validationStatus?.toUpperCase() === "DECLINED";
  const kind =
    isNegativeCorrection || isDeclinedCorrection ? "reversal" : "conversion";
  const amount = Math.abs(rawAmount);
  const providerStatus = [
    cleanOptional(record.actionStatus),
    cleanOptional(record.validationStatus ?? undefined),
  ]
    .filter(Boolean)
    .join(":") || undefined;

  const observation: AffiliateNetworkObservation = {
    provider: "cj-affiliate",
    accountRef: `cj:publisher:${publisherId}`,
    programRef: `cj:advertiser:${advertiserId}`,
    externalEventRef: `cj:commission:${commissionId}`,
    kind,
    providerStatus,
    economicState: cjEconomicState(
      record.actionStatus,
      record.validationStatus ?? undefined,
    ),
    customerOrSessionRef:
      cleanOptional(record.shopperId ?? undefined) ??
      cleanOptional(record.orderId ?? undefined),
    amount,
    currency: "USD",
    occurredAt,
    evidenceRefs: [
      `cj:publisher:${publisherId}:commission:${commissionId}`,
    ],
    metadata: compact({
      advertiser_name: cleanOptional(record.advertiserName),
      action_type: cleanOptional(record.actionType),
      original:
        record.original === undefined ? undefined : String(record.original),
      original_action_id: cleanOptional(record.originalActionId),
      correction_reason: cleanOptional(record.correctionReason ?? undefined),
      posting_date: cjDate(record.postingDate),
      order_id: cleanOptional(record.orderId ?? undefined),
    }),
  };
  assertAffiliateNetworkObservation(observation);
  return observation;
}

function cjEconomicState(
  actionStatus?: string,
  validationStatus?: string,
): AffiliateNetworkEconomicState {
  const validation = validationStatus?.trim().toUpperCase();
  if (validation === "DECLINED") return "rejected";
  if (validation === "PENDING") return "pending";
  if (validation === "ACCEPTED" || validation === "AUTOMATED") {
    return "approved";
  }

  const action = actionStatus?.trim().toUpperCase();
  if (action === "NEW" || action === "EXTENDED") return "pending";
  if (action === "LOCKED" || action === "CLOSED") return "approved";
  return "unknown";
}

function cjDate(value?: string): string | undefined {
  const cleaned = cleanOptional(value);
  if (!cleaned) return undefined;
  const parsed = Date.parse(cleaned);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

function requireText(value: string, field: string): string {
  if (!value.trim()) throw new Error(`${field} is required`);
  return value.trim();
}

function cleanOptional(value?: string): string | undefined {
  const cleaned = value?.trim();
  return cleaned || undefined;
}

function numberValue(value: string | number | undefined): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function compact(
  value: Record<string, string | undefined>,
): Record<string, string> | undefined {
  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] => entry[1] !== undefined,
  );
  return entries.length ? Object.fromEntries(entries) : undefined;
}
