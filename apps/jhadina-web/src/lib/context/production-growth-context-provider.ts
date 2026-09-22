import type { EvidenceRef, GrowthDomainContext } from "@jhadina/core-spine"
import {
  createGrowthIntelligenceReadRepository,
  type GrowthIntelligenceApprovalRow,
  type GrowthIntelligenceAudienceRow,
  type GrowthIntelligenceCampaignRow,
  type GrowthIntelligenceLifecycleRow,
  type GrowthIntelligenceObservationRow,
  type GrowthIntelligenceOutboxRow,
  type GrowthIntelligenceReadRepository,
} from "../growth/intelligence-read-repository"

export interface ProductionGrowthContextProviderOptions {
  repository?: GrowthIntelligenceReadRepository
  now?: () => Date
  maxCampaigns?: number
  maxAudiences?: number
  maxPendingWork?: number
  maxPerformance?: number
}

export class ProductionGrowthContextProvider {
  private readonly repository: GrowthIntelligenceReadRepository
  private readonly now: () => Date
  private readonly maxCampaigns: number
  private readonly maxAudiences: number
  private readonly maxPendingWork: number
  private readonly maxPerformance: number

  constructor(options: ProductionGrowthContextProviderOptions = {}) {
    this.repository = options.repository ?? createGrowthIntelligenceReadRepository()
    this.now = options.now ?? (() => new Date())
    this.maxCampaigns = options.maxCampaigns ?? 20
    this.maxAudiences = options.maxAudiences ?? 20
    this.maxPendingWork = options.maxPendingWork ?? 30
    this.maxPerformance = options.maxPerformance ?? 30
  }

  async getContext(input: {
    userId: string
    activeTask: string
  }): Promise<GrowthDomainContext | undefined> {
    if (!isGrowthContextRelevant(input.activeTask)) return undefined

    const limitations: string[] = []
    const uncertainty: string[] = []

    const [campaigns, audiences, approvals, outbox, observations, lifecycle] = await Promise.all([
      readOrFallback(() => this.repository.listCampaigns(input.userId), [], "campaigns", limitations),
      readOrFallback(() => this.repository.listAudiences(input.userId), [], "audiences", limitations),
      readOrFallback(() => this.repository.listApprovals(input.userId), [], "approvals", limitations),
      readOrFallback(() => this.repository.listOutbox(input.userId), [], "outbox", limitations),
      readOrFallback(() => this.repository.listObservations(input.userId), [], "performance observations", limitations),
      readOrFallback(() => this.repository.listLifecycleProposals(input.userId), [], "lifecycle proposals", limitations),
    ])

    if (!campaigns.length) uncertainty.push("No durable paid campaigns are visible to the authenticated user.")
    if (!observations.length && campaigns.length) {
      uncertainty.push("Campaigns exist but no provider performance observations are currently available.")
    }

    const observedAt = this.now().toISOString()
    return {
      campaigns: campaigns.slice(0, this.maxCampaigns).map(campaignEvidence),
      audiences: audiences.slice(0, this.maxAudiences).map(audienceEvidence),
      pendingWork: buildPendingWork(approvals, outbox, lifecycle)
        .slice(0, this.maxPendingWork),
      performance: observations
        .slice(0, this.maxPerformance)
        .map(observationEvidence),
      attention: buildAttentionEvidence(campaigns, approvals, outbox, observations, this.now())
        .slice(0, this.maxCampaigns),
      uncertainty,
      limitations,
      provenance: [
        {
          id: "growth-context:durable-state",
          source: "growth-core",
          observedAt,
          summary: "Growth context is read from authenticated owner-scoped durable Growth tables. It grants no campaign, spend, lifecycle-send, or publishing authority.",
          immutable: false,
        },
        {
          id: "growth-context:privacy-boundary",
          source: "growth-core",
          observedAt,
          summary: "Main intelligence receives campaign/audience/work/performance summaries only; raw audience definitions and customer identifiers are excluded by default.",
          immutable: true,
        },
      ],
    }
  }
}

export function createProductionGrowthContextProvider(
  options: ProductionGrowthContextProviderOptions = {},
): ProductionGrowthContextProvider {
  return new ProductionGrowthContextProvider(options)
}

async function readOrFallback<T>(
  read: () => Promise<T>,
  fallback: T,
  label: string,
  limitations: string[],
): Promise<T> {
  try {
    return await read()
  } catch {
    limitations.push(`growth ${label} unavailable for this request`)
    return fallback
  }
}

function campaignEvidence(campaign: GrowthIntelligenceCampaignRow): EvidenceRef {
  return {
    id: `growth-campaign:${campaign.id}`,
    source: "growth-paid-campaign",
    observedAt: campaign.updated_at,
    summary: [
      `name=${campaign.name}`,
      `campaignId=${campaign.id}`,
      `brand=${campaign.brand_id}`,
      `channel=${campaign.channel}`,
      `provider=${campaign.provider}`,
      `objective=${campaign.objective}`,
      `status=${campaign.status}`,
      `dailyBudget=${formatMinor(campaign.daily_budget_minor, campaign.currency)}`,
      campaign.lifetime_budget_minor !== null
        ? `lifetimeBudget=${formatMinor(campaign.lifetime_budget_minor, campaign.currency)}`
        : null,
      campaign.starts_at ? `startsAt=${campaign.starts_at}` : null,
      campaign.ends_at ? `endsAt=${campaign.ends_at}` : null,
      campaign.provider_campaign_id ? "providerCampaignLinked=true" : "providerCampaignLinked=false",
      campaign.last_error ? `lastError=${campaign.last_error}` : null,
    ].filter(Boolean).join("; "),
    immutable: false,
  }
}

function audienceEvidence(audience: GrowthIntelligenceAudienceRow): EvidenceRef {
  return {
    id: `growth-audience:${audience.id}`,
    source: "growth-audience",
    observedAt: audience.updated_at,
    summary: [
      `name=${audience.name}`,
      `audienceId=${audience.id}`,
      `brand=${audience.brand_id}`,
      `kind=${audience.kind}`,
      `status=${audience.status}`,
    ].join("; "),
    immutable: false,
  }
}

function observationEvidence(observation: GrowthIntelligenceObservationRow): EvidenceRef {
  return {
    id: `growth-observation:${observation.id}`,
    source: observation.source,
    observedAt: observation.observed_at,
    summary: [
      observation.campaign_id ? `campaignId=${observation.campaign_id}` : "campaignId=unbound",
      `confidence=${Number(observation.confidence).toFixed(2)}`,
      `metrics=${formatMetrics(observation.metrics)}`,
    ].join("; "),
    immutable: true,
  }
}

function buildPendingWork(
  approvals: readonly GrowthIntelligenceApprovalRow[],
  outbox: readonly GrowthIntelligenceOutboxRow[],
  lifecycle: readonly GrowthIntelligenceLifecycleRow[],
): EvidenceRef[] {
  const refs: EvidenceRef[] = []

  for (const approval of approvals) {
    if (approval.status !== "pending" && approval.status !== "approved") continue
    refs.push({
      id: `growth-approval:${approval.id}`,
      source: "growth-approval",
      observedAt: approval.approved_at ?? approval.requested_at,
      summary: [
        `campaignId=${approval.campaign_id}`,
        `type=${approval.type}`,
        `status=${approval.status}`,
        `expiresAt=${approval.expires_at}`,
        "authority=receipt-specific-only",
      ].join("; "),
      immutable: false,
    })
  }

  for (const job of outbox) {
    if (!["pending", "attempting", "failed", "ambiguous"].includes(job.status)) continue
    refs.push({
      id: `growth-outbox:${job.id}`,
      source: "growth-paid-outbox",
      observedAt: job.updated_at,
      summary: [
        `campaignId=${job.campaign_id}`,
        `channel=${job.channel}`,
        `provider=${job.provider}`,
        `operation=${job.operation_intent}`,
        `status=${job.status}`,
        `attempts=${job.attempt_count}`,
        job.last_error ? `lastError=${job.last_error}` : null,
      ].filter(Boolean).join("; "),
      immutable: false,
    })
  }

  for (const proposal of lifecycle) {
    if (!["draft", "pending_approval", "approved"].includes(proposal.status)) continue
    refs.push({
      id: `growth-lifecycle:${proposal.id}`,
      source: "growth-lifecycle",
      observedAt: proposal.updated_at,
      summary: [
        `action=${proposal.action}`,
        proposal.channel ? `channel=${proposal.channel}` : null,
        `status=${proposal.status}`,
        `requiresApproval=${proposal.requires_approval === true || proposal.status === "pending_approval"}`,
        `rationale=${truncate(proposal.rationale, 240)}`,
      ].filter(Boolean).join("; "),
      immutable: false,
    })
  }

  return refs.sort((a, b) => b.observedAt.localeCompare(a.observedAt) || a.id.localeCompare(b.id))
}

function buildAttentionEvidence(
  campaigns: readonly GrowthIntelligenceCampaignRow[],
  approvals: readonly GrowthIntelligenceApprovalRow[],
  outbox: readonly GrowthIntelligenceOutboxRow[],
  observations: readonly GrowthIntelligenceObservationRow[],
  now: Date,
): EvidenceRef[] {
  return campaigns
    .filter((campaign) => campaign.status !== "cancelled")
    .map((campaign) => {
      let score = 0
      const reasons: string[] = []

      if (campaign.status === "failed" || campaign.status === "ambiguous") {
        score += 70
        reasons.push(`campaign status is ${campaign.status}`)
      }
      if (campaign.last_error) {
        score += 25
        reasons.push("campaign has a recorded provider error")
      }

      const jobs = outbox.filter((job) => job.campaign_id === campaign.id)
      const exceptionJobs = jobs.filter((job) => job.status === "failed" || job.status === "ambiguous")
      if (exceptionJobs.length) {
        score += 60
        reasons.push(`${exceptionJobs.length} failed/ambiguous paid outbox job(s)`)
      }
      if (jobs.some((job) => job.status === "attempting")) {
        score += 20
        reasons.push("provider dispatch is currently attempting")
      }

      const pendingApprovals = approvals.filter((approval) =>
        approval.campaign_id === campaign.id && approval.status === "pending",
      )
      if (campaign.status === "pending_approval" || pendingApprovals.length) {
        score += 35
        reasons.push("campaign is waiting for explicit paid-ad approval")
      }

      const campaignObservations = observations
        .filter((observation) => observation.campaign_id === campaign.id)
        .sort((a, b) => b.observed_at.localeCompare(a.observed_at))

      if (["delivered", "attempting", "queued", "approved"].includes(campaign.status)) {
        if (!campaignObservations.length) {
          score += 20
          reasons.push("no provider performance observation is available")
        } else {
          const ageMs = now.getTime() - Date.parse(campaignObservations[0]!.observed_at)
          const ageDays = Number.isFinite(ageMs) ? Math.max(0, ageMs / 86_400_000) : 0
          if (ageDays > 7) {
            score += 10
            reasons.push(`latest performance observation is ${Math.floor(ageDays)} day(s) old`)
          }
        }
      }

      if (!reasons.length) reasons.push("no operational exception detected")

      return {
        score,
        ref: {
          id: `growth-attention:${campaign.id}`,
          source: "growth-attention",
          observedAt: now.toISOString(),
          summary: [
            `attentionScore=${score}`,
            `campaignId=${campaign.id}`,
            `name=${campaign.name}`,
            `brand=${campaign.brand_id}`,
            `channel=${campaign.channel}`,
            `status=${campaign.status}`,
            `reasons=${reasons.join(" | ")}`,
          ].join("; "),
          immutable: false,
        } satisfies EvidenceRef,
      }
    })
    .sort((a, b) => b.score - a.score || a.ref.id.localeCompare(b.ref.id))
    .map((entry) => entry.ref)
}

function formatMetrics(metrics: Record<string, unknown>): string {
  const values = Object.entries(metrics)
    .filter(([, value]) => typeof value === "number" && Number.isFinite(value))
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 12)
    .map(([name, value]) => `${name}=${value}`)
  return values.length ? values.join(", ") : "numeric metrics unavailable"
}

function formatMinor(value: number, currency: string): string {
  return `${currency} ${(value / 100).toFixed(2)}`
}

function truncate(value: string, max: number): string {
  const normalized = value.trim().replace(/\s+/g, " ")
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`
}

function isGrowthContextRelevant(activeTask: string): boolean {
  const normalized = activeTask.toLowerCase().replace(/[^a-z0-9]+/g, " ")
  const signals = [
    "growth", "campaign", "ad campaign", "paid ad", "paid media", "meta", "google ads",
    "tiktok ads", "linkedin ads", "reddit ads", "audience", "lookalike", "retarget",
    "attribution", "cac", "roas", "mer", "spend", "budget", "creative test",
    "experiment", "lifecycle", "customer acquisition", "conversion", "performance",
  ]
  return signals.some((signal) => normalized.includes(signal))
}
