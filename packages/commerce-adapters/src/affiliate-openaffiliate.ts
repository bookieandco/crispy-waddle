import {
  assertAffiliateProgramObservation,
  type AffiliateApprovalMode,
  type AffiliateAttributionModel,
  type AffiliateCommissionMode,
  type AffiliateCommissionType,
  type AffiliateProgramDiscoveryAdapter,
  type AffiliateProgramDiscoveryQuery,
  type AffiliateProgramKind,
  type AffiliateProgramObservation,
  type AffiliateTrackingMethod,
} from "./affiliate";

export interface RawOpenAffiliateProgram {
  name?: string;
  slug?: string;
  url?: string;
  kind?: string;
  source?: string;
  category?: string;
  tags?: string[];
  commission?: {
    type?: string;
    rate?: string | number;
    mode?: string;
    value?: number | null;
    currency?: string;
    duration?: string | null;
    conditions?: string | null;
  };
  cookie_days?: number;
  attribution?: string;
  tracking_method?: string;
  payout?: {
    minimum?: number;
    currency?: string;
    frequency?: string;
    methods?: string[];
  };
  signup_url?: string | null;
  approval?: string;
  approval_time?: string | null;
  restrictions?: string[] | null;
  network?: string | null;
  marketing_materials?: boolean;
  api_available?: boolean;
  dedicated_manager?: boolean;
  verified?: boolean;
  updated_at?: string | null;
  last_verified_at?: string | null;
  agents?: {
    prompt?: string;
    keywords?: string[];
    use_cases?: string[];
  };
}

export interface OpenAffiliateRegistryClient {
  search(input: {
    query?: string;
    category?: string;
    commissionType?: AffiliateCommissionType;
    verifiedOnly?: boolean;
    limit: number;
  }): Promise<RawOpenAffiliateProgram[]>;
  getProgram(programId: string): Promise<RawOpenAffiliateProgram | null>;
}

/**
 * Normalizes OpenAffiliate registry records into Commerce research observations.
 *
 * Important boundary: OpenAffiliate's public verification checks that an affiliate
 * program page/sign-up signal exists. It is useful discovery evidence, but not proof
 * that every commission, payout, restriction, attribution, or network term is current.
 * Terms that can change still need merchant/network source verification before launch.
 */
export class OpenAffiliateProgramDiscoveryAdapter
  implements AffiliateProgramDiscoveryAdapter
{
  readonly name = "openaffiliate";

  constructor(
    private readonly client: OpenAffiliateRegistryClient,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async search(
    query: AffiliateProgramDiscoveryQuery,
  ): Promise<AffiliateProgramObservation[]> {
    const limit = Math.max(1, Math.min(100, query.limit ?? 25));
    const rows = await this.client.search({
      query: cleanOptional(query.query),
      category: cleanOptional(query.category),
      commissionType: query.commissionType,
      verifiedOnly: query.verifiedOnly,
      limit,
    });

    return rows.flatMap((row) => {
      const normalized = normalizeOpenAffiliateProgram(row, this.now());
      return normalized ? [normalized] : [];
    });
  }

  async getProgram(programId: string): Promise<AffiliateProgramObservation | null> {
    const slug = programId.trim();
    if (!slug) throw new Error("OpenAffiliate programId is required");
    const row = await this.client.getProgram(slug);
    return row ? normalizeOpenAffiliateProgram(row, this.now()) : null;
  }
}

export function normalizeOpenAffiliateProgram(
  row: RawOpenAffiliateProgram,
  observedAt: string,
): AffiliateProgramObservation | null {
  const name = row.name?.trim();
  const slug = row.slug?.trim();
  const merchantUrl = row.url?.trim();
  const category = row.category?.trim();
  const commissionType = asCommissionType(row.commission?.type);
  const commissionMode = asCommissionMode(row.commission?.mode);
  const rateText =
    typeof row.commission?.rate === "number"
      ? String(row.commission.rate)
      : row.commission?.rate?.trim();

  if (
    !name ||
    !slug ||
    !merchantUrl ||
    !category ||
    !commissionType ||
    !commissionMode ||
    !rateText
  ) {
    return null;
  }

  const lastVerifiedAt = normalizeOptionalDate(row.last_verified_at);
  const updatedAt = normalizeOptionalDate(row.updated_at);
  const verificationRef = lastVerifiedAt
    ? `openaffiliate:program-page:${slug}:${lastVerifiedAt.slice(0, 10)}`
    : `openaffiliate:program-page:${slug}:unverified-date`;

  const program: AffiliateProgramObservation = {
    provider: "openaffiliate",
    sourceId: row.source?.trim() || "openaffiliate-registry",
    programId: slug,
    name,
    merchantUrl,
    signupUrl: cleanOptional(row.signup_url ?? undefined),
    category,
    tags: unique(row.tags ?? []),
    kind: asKind(row.kind) ?? "affiliate",
    network: cleanOptional(row.network ?? undefined),
    commission: {
      type: commissionType,
      rateText,
      mode: commissionMode,
      value:
        typeof row.commission?.value === "number" &&
        Number.isFinite(row.commission.value)
          ? row.commission.value
          : undefined,
      currency: row.commission?.currency?.trim().toUpperCase() || "USD",
      duration: cleanOptional(row.commission?.duration ?? undefined),
      conditions: cleanOptional(row.commission?.conditions ?? undefined),
    },
    cookieDays:
      Number.isInteger(row.cookie_days) && (row.cookie_days ?? -1) >= 0
        ? row.cookie_days
        : undefined,
    attribution: asAttribution(row.attribution),
    trackingMethod: asTrackingMethod(row.tracking_method),
    approval: asApproval(row.approval),
    approvalTime: cleanOptional(row.approval_time ?? undefined),
    payout: row.payout
      ? {
          minimum:
            typeof row.payout.minimum === "number" &&
            Number.isFinite(row.payout.minimum) &&
            row.payout.minimum >= 0
              ? row.payout.minimum
              : undefined,
          currency: row.payout.currency?.trim().toUpperCase(),
          frequency: cleanOptional(row.payout.frequency),
          methods: unique(row.payout.methods ?? []),
        }
      : undefined,
    restrictions: unique(row.restrictions ?? []),
    verification: {
      verified: row.verified === true,
      scope: "affiliate_program_page_signal",
      lastVerifiedAt,
    },
    evidenceRefs: unique([
      `openaffiliate:program:${slug}`,
      verificationRef,
    ]),
    observedAt: normalizeRequiredDate(observedAt),
    metadata: compactMetadata({
      registry_updated_at: updatedAt,
      marketing_materials:
        row.marketing_materials === undefined
          ? undefined
          : String(row.marketing_materials),
      affiliate_api_available:
        row.api_available === undefined ? undefined : String(row.api_available),
      dedicated_manager:
        row.dedicated_manager === undefined
          ? undefined
          : String(row.dedicated_manager),
      agent_prompt: cleanOptional(row.agents?.prompt),
      agent_keywords: row.agents?.keywords?.length
        ? unique(row.agents.keywords).join(",")
        : undefined,
      agent_use_cases: row.agents?.use_cases?.length
        ? unique(row.agents.use_cases).join(" | ")
        : undefined,
    }),
  };

  assertAffiliateProgramObservation(program);
  return program;
}

function asKind(value?: string): AffiliateProgramKind | undefined {
  return [
    "affiliate",
    "referral",
    "creator-payout",
    "revenue-share",
    "cashback",
    "partner-network",
  ].includes(value ?? "")
    ? (value as AffiliateProgramKind)
    : undefined;
}

function asCommissionType(value?: string): AffiliateCommissionType | undefined {
  return ["recurring", "one-time", "tiered", "hybrid"].includes(value ?? "")
    ? (value as AffiliateCommissionType)
    : undefined;
}

function asCommissionMode(value?: string): AffiliateCommissionMode | undefined {
  return ["percentage", "flat", "tiered", "hybrid", "unknown"].includes(
    value ?? "",
  )
    ? (value as AffiliateCommissionMode)
    : undefined;
}

function asAttribution(value?: string): AffiliateAttributionModel | undefined {
  return ["last-click", "first-click", "multi-touch"].includes(value ?? "")
    ? (value as AffiliateAttributionModel)
    : undefined;
}

function asTrackingMethod(value?: string): AffiliateTrackingMethod | undefined {
  return ["cookie", "server-side", "hybrid"].includes(value ?? "")
    ? (value as AffiliateTrackingMethod)
    : undefined;
}

function asApproval(value?: string): AffiliateApprovalMode | undefined {
  return ["auto", "manual", "invite-only"].includes(value ?? "")
    ? (value as AffiliateApprovalMode)
    : undefined;
}

function cleanOptional(value?: string): string | undefined {
  const cleaned = value?.trim();
  return cleaned || undefined;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeRequiredDate(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("OpenAffiliate observation timestamp is invalid");
  }
  return new Date(parsed).toISOString();
}

function normalizeOptionalDate(value?: string | null): string | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

function compactMetadata(
  value: Record<string, string | undefined>,
): Record<string, string> | undefined {
  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] => Boolean(entry[1]),
  );
  return entries.length ? Object.fromEntries(entries) : undefined;
}
