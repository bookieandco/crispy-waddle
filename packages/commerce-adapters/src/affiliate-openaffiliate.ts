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
  cookieDays?: number;
  attribution?: string;
  tracking_method?: string;
  trackingMethod?: string;
  payout?: {
    minimum?: number;
    currency?: string;
    frequency?: string;
    methods?: string[];
  };
  signup_url?: string | null;
  signupUrl?: string | null;
  approval?: string;
  approval_time?: string | null;
  approvalTime?: string | null;
  restrictions?: string[] | null;
  network?: string | null;
  marketing_materials?: boolean;
  marketingMaterials?: boolean;
  api_available?: boolean;
  apiAvailable?: boolean;
  dedicated_manager?: boolean;
  dedicatedManager?: boolean;
  verified?: boolean;
  updated_at?: string | null;
  updatedAt?: string | null;
  last_verified_at?: string | null;
  lastVerifiedAt?: string | null;
  agentPrompt?: string;
  agentKeywords?: string[];
  agentUseCases?: string[];
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

export interface OpenAffiliateFetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<unknown>;
}

export type OpenAffiliateFetch = (
  input: string,
  init?: { headers?: Record<string, string> },
) => Promise<OpenAffiliateFetchResponse>;

/**
 * Public read-only OpenAffiliate REST client. No affiliate account credentials
 * are involved; this only reads the open registry.
 */
export class OpenAffiliateHttpClient implements OpenAffiliateRegistryClient {
  constructor(
    private readonly fetchImpl: OpenAffiliateFetch,
    private readonly baseUrl = "https://openaffiliate.dev",
  ) {}

  async search(input: {
    query?: string;
    category?: string;
    commissionType?: AffiliateCommissionType;
    verifiedOnly?: boolean;
    limit: number;
  }): Promise<RawOpenAffiliateProgram[]> {
    const url = new URL("/api/programs", this.baseUrl);
    if (input.query) url.searchParams.set("q", input.query);
    if (input.category) url.searchParams.set("category", input.category);
    if (input.commissionType) url.searchParams.set("type", input.commissionType);
    if (input.verifiedOnly) url.searchParams.set("verified", "true");
    url.searchParams.set("limit", String(Math.max(1, Math.min(100, input.limit))));

    const body = await this.getJson(url.toString());
    if (!isRecord(body) || !Array.isArray(body.programs)) {
      throw new Error("OpenAffiliate search response is malformed");
    }
    return body.programs.filter(isRecord) as RawOpenAffiliateProgram[];
  }

  async getProgram(programId: string): Promise<RawOpenAffiliateProgram | null> {
    const slug = programId.trim();
    if (!slug) throw new Error("OpenAffiliate programId is required");
    const url = new URL(`/api/programs/${encodeURIComponent(slug)}`, this.baseUrl);
    const response = await this.fetchImpl(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(
        `OpenAffiliate API error: ${response.status} ${response.statusText}`,
      );
    }
    const body = await response.json();
    if (!isRecord(body)) {
      throw new Error("OpenAffiliate program response is malformed");
    }
    return body as RawOpenAffiliateProgram;
  }

  private async getJson(url: string): Promise<unknown> {
    const response = await this.fetchImpl(url, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(
        `OpenAffiliate API error: ${response.status} ${response.statusText}`,
      );
    }
    return response.json();
  }
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

  const lastVerifiedAt = normalizeOptionalDate(
    row.lastVerifiedAt ?? row.last_verified_at,
  );
  const updatedAt = normalizeOptionalDate(row.updatedAt ?? row.updated_at);
  const verificationRef = lastVerifiedAt
    ? `openaffiliate:program-page:${slug}:${lastVerifiedAt.slice(0, 10)}`
    : `openaffiliate:program-page:${slug}:unverified-date`;

  const program: AffiliateProgramObservation = {
    provider: "openaffiliate",
    sourceId: row.source?.trim() || "openaffiliate-registry",
    programId: slug,
    name,
    merchantUrl,
    signupUrl: cleanOptional(row.signupUrl ?? row.signup_url ?? undefined),
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
    cookieDays: normalizeCookieDays(row.cookieDays ?? row.cookie_days),
    attribution: asAttribution(row.attribution),
    trackingMethod: asTrackingMethod(
      row.trackingMethod ?? row.tracking_method,
    ),
    approval: asApproval(row.approval),
    approvalTime: cleanOptional(
      row.approvalTime ?? row.approval_time ?? undefined,
    ),
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
        row.marketingMaterials ?? row.marketing_materials,
      affiliate_api_available:
        row.apiAvailable ?? row.api_available,
      dedicated_manager:
        row.dedicatedManager ?? row.dedicated_manager,
      agent_prompt: cleanOptional(row.agentPrompt ?? row.agents?.prompt),
      agent_keywords:
        (row.agentKeywords ?? row.agents?.keywords)?.length
          ? unique(row.agentKeywords ?? row.agents?.keywords ?? []).join(",")
          : undefined,
      agent_use_cases:
        (row.agentUseCases ?? row.agents?.use_cases)?.length
          ? unique(row.agentUseCases ?? row.agents?.use_cases ?? []).join(" | ")
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

function normalizeCookieDays(value?: number): number | undefined {
  return Number.isInteger(value) && (value ?? -1) >= 0 ? value : undefined;
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
  value: Record<string, string | boolean | undefined>,
): Record<string, string> | undefined {
  const entries = Object.entries(value)
    .filter((entry): entry is [string, string | boolean] => entry[1] !== undefined)
    .map(([key, value]) => [key, String(value)] as [string, string]);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
