export type AffiliateNetworkEventKind =
  | "click"
  | "conversion"
  | "reversal"
  | "payout";

export type AffiliateNetworkEconomicState =
  | "pending"
  | "approved"
  | "rejected"
  | "paid"
  | "unknown";

export interface AffiliateNetworkObservation {
  provider: string;
  accountRef: string;
  programRef: string;
  externalEventRef: string;
  kind: AffiliateNetworkEventKind;
  providerStatus?: string;
  economicState?: AffiliateNetworkEconomicState;
  customerOrSessionRef?: string;
  amount?: number;
  currency?: string;
  occurredAt: string;
  evidenceRefs: string[];
  metadata?: Record<string, string>;
}

export interface AffiliateNetworkReadRequest {
  accountRef: string;
  startAt?: string;
  endAt?: string;
  cursor?: string;
  limit?: number;
}

export interface AffiliateNetworkReadBatch {
  provider: string;
  accountRef: string;
  observations: AffiliateNetworkObservation[];
  nextCursor?: string;
  complete: boolean;
  readOnly: true;
}

export interface AffiliateNetworkObservationAdapter {
  readonly name: string;
  read(request: AffiliateNetworkReadRequest): Promise<AffiliateNetworkReadBatch>;
}

export function assertAffiliateNetworkObservation(
  observation: AffiliateNetworkObservation,
): void {
  for (const [field, value] of [
    ["provider", observation.provider],
    ["accountRef", observation.accountRef],
    ["programRef", observation.programRef],
    ["externalEventRef", observation.externalEventRef],
    ["occurredAt", observation.occurredAt],
  ] as const) {
    if (!value.trim()) throw new Error(`Affiliate network ${field} is required`);
  }

  if (!Number.isFinite(Date.parse(observation.occurredAt))) {
    throw new Error("Affiliate network occurredAt is invalid");
  }

  if (
    observation.amount !== undefined &&
    (!Number.isFinite(observation.amount) || observation.amount < 0)
  ) {
    throw new Error("Affiliate network amount must be finite and non-negative");
  }

  if (
    observation.amount !== undefined &&
    (!observation.currency || !observation.currency.trim())
  ) {
    throw new Error("Affiliate network currency is required when amount is present");
  }

  if (
    ["conversion", "reversal", "payout"].includes(observation.kind) &&
    observation.amount === undefined
  ) {
    throw new Error(
      `Affiliate network ${observation.kind} observation requires an amount`,
    );
  }

  if (
    observation.evidenceRefs.length === 0 ||
    observation.evidenceRefs.some((ref) => !ref.trim())
  ) {
    throw new Error("Affiliate network observation requires evidence");
  }
}

export function normalizeAffiliateNetworkLimit(
  value: number | undefined,
  maximum = 300,
  fallback = 100,
): number {
  const requested = value ?? fallback;
  if (!Number.isInteger(requested) || requested < 1) {
    throw new Error("Affiliate network limit must be a positive integer");
  }
  return Math.min(requested, maximum);
}

export function normalizeAffiliateNetworkDate(
  value: string,
  field: string,
): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${field} must be a valid date`);
  }
  return new Date(parsed).toISOString();
}
