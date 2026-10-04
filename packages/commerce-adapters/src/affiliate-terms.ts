import type {
  AffiliateApprovalMode,
  AffiliateAttributionModel,
  AffiliateCommissionObservation,
  AffiliatePayoutObservation,
  AffiliateProgramObservation,
  AffiliateTrackingMethod,
} from "./affiliate";

export type AffiliateTermsSourceKind =
  | "registry"
  | "official_merchant"
  | "official_network";

export type AffiliateTermsSnapshot = {
  programId: string;
  provider: string;
  sourceKind: AffiliateTermsSourceKind;
  sourceUrl: string;
  capturedAt: string;
  commission: AffiliateCommissionObservation;
  cookieDays?: number;
  attribution?: AffiliateAttributionModel;
  trackingMethod?: AffiliateTrackingMethod;
  approval?: AffiliateApprovalMode;
  approvalTime?: string;
  payout?: AffiliatePayoutObservation;
  restrictions: string[];
  network?: string;
  evidenceRefs: string[];
  externalActionAuthorized: false;
};

export type AffiliateTermsChangeField =
  | "commission"
  | "cookie_days"
  | "attribution"
  | "tracking_method"
  | "approval"
  | "approval_time"
  | "payout"
  | "restrictions"
  | "network";

export type AffiliateTermsChangeImpact =
  | "economics"
  | "attribution"
  | "policy"
  | "operations";

export type AffiliateTermsChange = {
  field: AffiliateTermsChangeField;
  impact: AffiliateTermsChangeImpact;
  before?: string;
  after?: string;
};

export type AffiliateTermsDrift = {
  programId: string;
  changed: boolean;
  changes: AffiliateTermsChange[];
  previousCapturedAt: string;
  currentCapturedAt: string;
  requiresReevaluation: boolean;
  publishingAuthorized: false;
  moneyMovementAuthorized: false;
};

export type AffiliateTermsFreshnessPolicy = {
  maxAgeDays: number;
  requireOfficialSource: boolean;
};

export type AffiliateTermsFreshnessResult = {
  status: "fresh" | "stale" | "official_source_required";
  ageDays: number;
  blockers: string[];
  evidenceRefs: string[];
};

export function affiliateTermsSnapshotFromProgram(
  program: AffiliateProgramObservation,
  input: {
    sourceKind: AffiliateTermsSourceKind;
    sourceUrl?: string;
    capturedAt?: string;
    evidenceRefs?: string[];
  },
): AffiliateTermsSnapshot {
  const sourceUrl =
    input.sourceUrl?.trim() || program.signupUrl || program.merchantUrl;
  const capturedAt = input.capturedAt ?? program.observedAt;
  if (!isHttpUrl(sourceUrl)) {
    throw new Error("Affiliate terms sourceUrl must be an http(s) URL");
  }
  requireDate(capturedAt, "Affiliate terms capturedAt");

  return {
    programId: requireText(program.programId, "Affiliate terms programId"),
    provider: requireText(program.provider, "Affiliate terms provider"),
    sourceKind: input.sourceKind,
    sourceUrl,
    capturedAt: new Date(Date.parse(capturedAt)).toISOString(),
    commission: { ...program.commission },
    cookieDays: program.cookieDays,
    attribution: program.attribution,
    trackingMethod: program.trackingMethod,
    approval: program.approval,
    approvalTime: program.approvalTime,
    payout: program.payout
      ? { ...program.payout, methods: [...program.payout.methods] }
      : undefined,
    restrictions: unique(program.restrictions),
    network: program.network,
    evidenceRefs: unique([
      ...program.evidenceRefs,
      ...(input.evidenceRefs ?? []),
    ]),
    externalActionAuthorized: false,
  };
}

export function compareAffiliateTerms(
  previous: AffiliateTermsSnapshot,
  current: AffiliateTermsSnapshot,
): AffiliateTermsDrift {
  if (previous.programId !== current.programId) {
    throw new Error("Affiliate terms snapshots must refer to the same program");
  }
  requireDate(previous.capturedAt, "Previous affiliate terms capturedAt");
  requireDate(current.capturedAt, "Current affiliate terms capturedAt");

  const changes: AffiliateTermsChange[] = [];
  pushChange(
    changes,
    "commission",
    "economics",
    stableJson(previous.commission),
    stableJson(current.commission),
  );
  pushChange(
    changes,
    "cookie_days",
    "attribution",
    scalar(previous.cookieDays),
    scalar(current.cookieDays),
  );
  pushChange(
    changes,
    "attribution",
    "attribution",
    previous.attribution,
    current.attribution,
  );
  pushChange(
    changes,
    "tracking_method",
    "attribution",
    previous.trackingMethod,
    current.trackingMethod,
  );
  pushChange(
    changes,
    "approval",
    "operations",
    previous.approval,
    current.approval,
  );
  pushChange(
    changes,
    "approval_time",
    "operations",
    previous.approvalTime,
    current.approvalTime,
  );
  pushChange(
    changes,
    "payout",
    "economics",
    stableJson(previous.payout),
    stableJson(current.payout),
  );
  pushChange(
    changes,
    "restrictions",
    "policy",
    stableJson([...previous.restrictions].sort()),
    stableJson([...current.restrictions].sort()),
  );
  pushChange(
    changes,
    "network",
    "operations",
    previous.network,
    current.network,
  );

  return {
    programId: current.programId,
    changed: changes.length > 0,
    changes,
    previousCapturedAt: previous.capturedAt,
    currentCapturedAt: current.capturedAt,
    requiresReevaluation: changes.length > 0,
    publishingAuthorized: false,
    moneyMovementAuthorized: false,
  };
}

export function evaluateAffiliateTermsFreshness(
  snapshot: AffiliateTermsSnapshot,
  policy: AffiliateTermsFreshnessPolicy,
  now = new Date().toISOString(),
): AffiliateTermsFreshnessResult {
  requireDate(snapshot.capturedAt, "Affiliate terms capturedAt");
  requireDate(now, "Affiliate terms freshness now");
  if (!Number.isFinite(policy.maxAgeDays) || policy.maxAgeDays < 0) {
    throw new Error("Affiliate terms maxAgeDays must be non-negative");
  }

  const ageDays = Math.max(
    0,
    (Date.parse(now) - Date.parse(snapshot.capturedAt)) / 86_400_000,
  );
  const blockers: string[] = [];

  const official =
    snapshot.sourceKind === "official_merchant" ||
    snapshot.sourceKind === "official_network";

  if (policy.requireOfficialSource && !official) {
    blockers.push("Official merchant/network terms source is required.");
  }
  if (ageDays > policy.maxAgeDays) {
    blockers.push(
      `Affiliate terms are ${Math.floor(ageDays)} days old; refresh required.`,
    );
  }

  return {
    status:
      policy.requireOfficialSource && !official
        ? "official_source_required"
        : ageDays > policy.maxAgeDays
          ? "stale"
          : "fresh",
    ageDays,
    blockers,
    evidenceRefs: [...snapshot.evidenceRefs],
  };
}

function pushChange(
  output: AffiliateTermsChange[],
  field: AffiliateTermsChangeField,
  impact: AffiliateTermsChangeImpact,
  before: string | undefined,
  after: string | undefined,
): void {
  if (before === after) return;
  output.push({ field, impact, before, after });
}

function scalar(value: string | number | undefined): string | undefined {
  return value === undefined ? undefined : String(value);
}

function stableJson(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, sortValue(nested)]),
    );
  }
  return value;
}

function requireText(value: string, field: string): string {
  if (!value.trim()) throw new Error(`${field} is required`);
  return value.trim();
}

function requireDate(value: string, field: string): string {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`${field} must be a valid date`);
  }
  return value;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
