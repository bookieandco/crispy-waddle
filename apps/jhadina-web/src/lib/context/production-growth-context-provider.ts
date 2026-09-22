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
import type {
  GrowthCreativeExperimentAssessmentRow,
  GrowthCreativeExperimentObservationRow,
  GrowthCreativeExperimentRow,
  GrowthCreativeVariantLineageRow,
  GrowthEvidenceHealthAssessmentRow,
} from "../growth/creative-experiment-repository"

export interface ProductionGrowthContextProviderOptions {
  repository?: GrowthIntelligenceReadRepository
  now?: () => Date
  maxCampaigns?: number
  maxAudiences?: number
  maxPendingWork?: number
  maxPerformance?: number
  maxExperiments?: number
  maxEvidenceHealth?: number
  maxLearning?: number
}

export class ProductionGrowthContextProvider {
  private readonly repository: GrowthIntelligenceReadRepository
  private readonly now: () => Date
  private readonly maxCampaigns: number
  private readonly maxAudiences: number
  private readonly maxPendingWork: number
  private readonly maxPerformance: number
  private readonly maxExperiments: number
  private readonly maxEvidenceHealth: number
  private readonly maxLearning: number

  constructor(options: ProductionGrowthContextProviderOptions = {}) {
    this.repository = options.repository ?? createGrowthIntelligenceReadRepository()
    this.now = options.now ?? (() => new Date())
    this.maxCampaigns = options.maxCampaigns ?? 20
    this.maxAudiences = options.maxAudiences ?? 20
    this.maxPendingWork = options.maxPendingWork ?? 30
    this.maxPerformance = options.maxPerformance ?? 30
    this.maxExperiments = options.maxExperiments ?? 30
    this.maxEvidenceHealth = options.maxEvidenceHealth ?? 30
    this.maxLearning = options.maxLearning ?? 50
  }

  async getContext(input: {
    userId: string
    activeTask: string
  }): Promise<GrowthDomainContext | undefined> {
    if (!isGrowthContextRelevant(input.activeTask)) return undefined

    const limitations: string[] = []
    const uncertainty: string[] = []

    const [
      campaigns, audiences, approvals, outbox, observations, lifecycle,
      experiments, variantLineage, experimentObservations, evidenceHealth, experimentAssessments,
    ] = await Promise.all([
      readOrFallback(() => this.repository.listCampaigns(input.userId), [], "campaigns", limitations),
      readOrFallback(() => this.repository.listAudiences(input.userId), [], "audiences", limitations),
      readOrFallback(() => this.repository.listApprovals(input.userId), [], "approvals", limitations),
      readOrFallback(() => this.repository.listOutbox(input.userId), [], "outbox", limitations),
      readOrFallback(() => this.repository.listObservations(input.userId), [], "performance observations", limitations),
      readOrFallback(() => this.repository.listLifecycleProposals(input.userId), [], "lifecycle proposals", limitations),
      readOrFallback(() => this.repository.listCreativeExperiments(input.userId), [], "creative experiments", limitations),
      readOrFallback(() => this.repository.listCreativeVariantLineage(input.userId), [], "creative variant lineage", limitations),
      readOrFallback(() => this.repository.listCreativeExperimentObservations(input.userId), [], "creative experiment observations", limitations),
      readOrFallback(() => this.repository.listEvidenceHealthAssessments(input.userId), [], "evidence health", limitations),
      readOrFallback(() => this.repository.listCreativeExperimentAssessments(input.userId), [], "creative experiment assessments", limitations),
    ])

    if (!campaigns.length) uncertainty.push("No durable paid campaigns are visible to the authenticated user.")
    if (!observations.length && campaigns.length) {
      uncertainty.push("Campaigns exist but no provider performance observations are currently available.")
    }
    if (experiments.length && !evidenceHealth.length) {
      uncertainty.push("Creative experiments exist but no persisted evidence-health assessments are currently available.")
    }
    if (experiments.length && !experimentAssessments.length) {
      uncertainty.push("Creative experiments exist but no persisted A/B assessments are currently available.")
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
      experiments: experiments
        .slice(0, this.maxExperiments)
        .map((experiment) => experimentEvidence(experiment, variantLineage, experimentObservations)),
      evidenceHealth: evidenceHealth
        .slice(0, this.maxEvidenceHealth)
        .map(evidenceHealthEvidence),
      learning: experimentAssessments
        .slice(0, this.maxLearning)
        .map(experimentAssessmentEvidence),
      attention: [
        ...buildExperimentAttentionEvidence(
          experiments,
          experimentObservations,
          evidenceHealth,
          experimentAssessments,
          this.now(),
        ),
        ...buildAttentionEvidence(campaigns, approvals, outbox, observations, this.now()),
      ].slice(0, this.maxCampaigns + this.maxExperiments),
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
          summary: "Main intelligence receives campaign/audience/work/performance/experiment-learning summaries only; raw audience definitions, customer identifiers, and raw experiment JSON payloads are excluded by default.",
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

function experimentEvidence(
  experiment: GrowthCreativeExperimentRow,
  lineage: readonly GrowthCreativeVariantLineageRow[],
  observations: readonly GrowthCreativeExperimentObservationRow[],
): EvidenceRef {
  const experimentLineage = lineage.filter((row) => row.experiment_id === experiment.id)
  const experimentObservations = observations.filter((row) => row.experiment_id === experiment.id)
  const control = experimentLineage.find((row) => row.variant_id === experiment.control_variant_id)
  const treatments = experimentLineage.filter((row) => experiment.treatment_variant_ids.includes(row.variant_id))
  return {
    id: `growth-experiment:${experiment.id}`,
    source: "growth-creative-experiment",
    observedAt: experiment.updated_at,
    summary: [
      `name=${experiment.name}`,
      `experimentId=${experiment.id}`,
      `experimentKey=${experiment.experiment_key}`,
      `brand=${experiment.brand_id}`,
      `status=${experiment.status}`,
      `mutationAxis=${experiment.mutation_axis}`,
      `controlVariant=${experiment.control_variant_id}`,
      `treatmentVariants=${experiment.treatment_variant_ids.join(",")}`,
      `lineageBound=${experimentLineage.length}`,
      `observationRows=${experimentObservations.length}`,
      control ? `controlDirectorArtifact=${control.director_artifact_id}` : "controlDirectorArtifact=unavailable",
      treatments.length ? `treatmentDirectorArtifacts=${treatments.map((row) => row.director_artifact_id).join(",")}` : "treatmentDirectorArtifacts=unavailable",
      "authority=LEARNING_PLAN_ONLY",
    ].join("; "),
    immutable: false,
  }
}

function evidenceHealthEvidence(health: GrowthEvidenceHealthAssessmentRow): EvidenceRef {
  return {
    id: `growth-evidence-health:${health.id}`,
    source: "growth-evidence-health",
    observedAt: health.checked_at,
    summary: [
      health.experiment_id ? `experimentId=${health.experiment_id}` : "experimentId=unbound",
      `source=${health.source}`,
      `assetRef=${health.asset_ref}`,
      `severity=${health.severity}`,
      `freshness=${health.freshness}`,
      `allowedForLearning=${health.allowed_for_learning}`,
      `completeness=${Number(health.completeness).toFixed(3)}`,
      `monitorCoverage=${Number(health.monitor_coverage).toFixed(3)}`,
      `lineageComplete=${health.lineage_complete}`,
      `blockers=${health.blockers.join("|") || "none"}`,
      `warnings=${health.warnings.join("|") || "none"}`,
    ].join("; "),
    immutable: true,
  }
}

function experimentAssessmentEvidence(assessment: GrowthCreativeExperimentAssessmentRow): EvidenceRef {
  return {
    id: `growth-experiment-assessment:${assessment.id}`,
    source: "growth-creative-experiment-assessment",
    observedAt: assessment.assessed_at,
    summary: [
      `experimentId=${assessment.experiment_id}`,
      `controlVariant=${assessment.control_variant_id}`,
      `treatmentVariant=${assessment.treatment_variant_id}`,
      `status=${assessment.status}`,
      `decision=${assessment.decision}`,
      `controlRate=${Number(assessment.control_rate).toFixed(6)}`,
      `treatmentRate=${Number(assessment.treatment_rate).toFixed(6)}`,
      assessment.relative_lift === null ? "relativeLift=unavailable" : `relativeLift=${Number(assessment.relative_lift).toFixed(6)}`,
      assessment.p_value === null ? "pValue=unavailable" : `pValue=${Number(assessment.p_value).toFixed(6)}`,
      `incrementalContributionPerExposure=${Number(assessment.incremental_contribution_per_exposure).toFixed(6)}`,
      assessment.health_assessment_id ? `healthAssessmentId=${assessment.health_assessment_id}` : "healthAssessmentId=unavailable",
      "authority=LEARNING_ONLY",
    ].join("; "),
    immutable: true,
  }
}

function buildExperimentAttentionEvidence(
  experiments: readonly GrowthCreativeExperimentRow[],
  observations: readonly GrowthCreativeExperimentObservationRow[],
  health: readonly GrowthEvidenceHealthAssessmentRow[],
  assessments: readonly GrowthCreativeExperimentAssessmentRow[],
  now: Date,
): EvidenceRef[] {
  return experiments
    .filter((experiment) => experiment.status !== "cancelled")
    .map((experiment) => {
      let score = 0
      const reasons: string[] = []
      const experimentObservations = observations.filter((row) => row.experiment_id === experiment.id)
      const latestHealth = health
        .filter((row) => row.experiment_id === experiment.id)
        .sort((a, b) => b.checked_at.localeCompare(a.checked_at))[0]
      const latestAssessments = assessments
        .filter((row) => row.experiment_id === experiment.id)
        .sort((a, b) => b.assessed_at.localeCompare(a.assessed_at))

      if (experiment.status === "running" && experimentObservations.length === 0) {
        score += 30
        reasons.push("running experiment has no persisted observations")
      }
      if (experiment.status === "running" && !latestHealth) {
        score += 35
        reasons.push("running experiment has no evidence-health assessment")
      }
      if (latestHealth?.severity === "blocked") {
        score += 80
        reasons.push(`evidence health is blocked: ${latestHealth.blockers.join(",") || "unspecified blocker"}`)
      } else if (latestHealth?.severity === "degraded") {
        score += 25
        reasons.push(`evidence health is degraded: ${latestHealth.warnings.join(",") || "warning"}`)
      }
      if (latestHealth) {
        const ageMs = now.getTime() - Date.parse(latestHealth.checked_at)
        if (Number.isFinite(ageMs) && ageMs > 7 * 86_400_000) {
          score += 15
          reasons.push(`latest evidence-health check is ${Math.floor(ageMs / 86_400_000)} day(s) old`)
        }
      }
      if (experiment.status === "running" && latestAssessments.length === 0) {
        score += 20
        reasons.push("running experiment has no persisted A/B assessment")
      }
      if (latestAssessments.some((row) => row.status === "insufficient_evidence")) {
        score += 15
        reasons.push("latest assessment still has insufficient evidence")
      }
      if (latestAssessments.some((row) => row.status === "treatment_underperformed")) {
        score += 30
        reasons.push("a treatment is statistically underperforming the control")
      }
      if (experiment.status === "paused") {
        score += 10
        reasons.push("experiment is paused")
      }
      if (!reasons.length) reasons.push("no experiment evidence exception detected")

      return {
        score,
        ref: {
          id: `growth-experiment-attention:${experiment.id}`,
          source: "growth-experiment-attention",
          observedAt: now.toISOString(),
          summary: [
            `attentionScore=${score}`,
            `experimentId=${experiment.id}`,
            `name=${experiment.name}`,
            `brand=${experiment.brand_id}`,
            `status=${experiment.status}`,
            `reasons=${reasons.join(" | ")}`,
            "authority=READ_ONLY",
          ].join("; "),
          immutable: false,
        } satisfies EvidenceRef,
      }
    })
    .sort((a, b) => b.score - a.score || a.ref.id.localeCompare(b.ref.id))
    .map((entry) => entry.ref)
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
  const normalized = activeTask.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim()
  const signals = [
    "growth", "campaign", "campaigns", "ad campaign", "paid ad", "paid ads", "paid media",
    "meta", "google ads", "tiktok ads", "linkedin ads", "reddit ads", "audience", "audiences",
    "lookalike", "retarget", "retargeting", "attribution", "cac", "roas", "mer",
    "ad spend", "ad budget", "creative test", "creative experiment", "lifecycle", "customer acquisition",
  ]
  return signals.some((signal) => ` ${normalized} `.includes(` ${signal} `))
}
