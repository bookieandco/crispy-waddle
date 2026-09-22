import {
  listSocialCharacterProfiles,
  type SocialAccount,
  type SocialObservation,
  type SocialOutboxJob,
  type SocialPublicationProposal,
} from "@jhadina/social-core"
import type { EvidenceRef, SocialDomainContext } from "@jhadina/core-spine"
import {
  createSocialRepository,
  type SocialRepository,
} from "../social/repository"

export interface ProductionSocialContextProviderOptions {
  repository?: SocialRepository
  now?: () => Date
  maxAccounts?: number
  maxPerformance?: number
  maxPendingWork?: number
}

export class ProductionSocialContextProvider {
  private readonly repository: SocialRepository
  private readonly now: () => Date
  private readonly maxAccounts: number
  private readonly maxPerformance: number
  private readonly maxPendingWork: number

  constructor(options: ProductionSocialContextProviderOptions = {}) {
    this.repository = options.repository ?? createSocialRepository()
    this.now = options.now ?? (() => new Date())
    this.maxAccounts = options.maxAccounts ?? 24
    this.maxPerformance = options.maxPerformance ?? 20
    this.maxPendingWork = options.maxPendingWork ?? 20
  }

  async getContext(input: {
    userId: string
    activeTask: string
  }): Promise<SocialDomainContext | undefined> {
    const limitations: string[] = []
    const uncertainty: string[] = []

    const [accounts, proposals, outbox, observations] = await Promise.all([
      readOrFallback(() => this.repository.listAccounts(input.userId), [], "accounts", limitations),
      readOrFallback(() => this.repository.listProposals(input.userId), [], "proposals", limitations),
      readOrFallback(() => this.repository.listOutbox(input.userId), [], "outbox", limitations),
      readOrFallback(() => this.repository.listObservations(input.userId), [], "observations", limitations),
    ])

    const connected = accounts
      .filter((account) => account.status === "connected")
      .sort(accountSort)
      .slice(0, this.maxAccounts)

    if (!connected.length) {
      uncertainty.push("No connected social accounts are visible to the authenticated user.")
    }

    const connectedBrands = new Set(connected.map((account) => account.brand))
    const characters = listSocialCharacterProfiles()
      .filter((profile) => connectedBrands.size === 0 || connectedBrands.has(profile.brand))
      .map((profile) => characterEvidence(profile, this.now().toISOString()))

    const pendingWork = buildPendingWork(proposals, outbox)
      .slice(0, this.maxPendingWork)

    const performance = observations
      .filter((observation) => observation.kind === "performance")
      .sort((a, b) => b.observedAt.localeCompare(a.observedAt))
      .slice(0, this.maxPerformance)
      .map(performanceEvidence)

    const attention = buildAttentionEvidence(
      connected,
      proposals,
      outbox,
      observations,
      this.now(),
    )

    return {
      accounts: connected.map(accountEvidence),
      characters,
      pendingWork,
      performance,
      attention,
      uncertainty,
      limitations,
      provenance: [
        {
          id: "social-context:accounts",
          source: "social-core",
          observedAt: this.now().toISOString(),
          summary: "Connected account state read from the authenticated Social repository.",
          immutable: false,
        },
        {
          id: "social-context:character-profiles",
          source: "social-core",
          observedAt: this.now().toISOString(),
          summary: "Character/personality choices come from the governed Social character registry and grant expression constraints only.",
          immutable: true,
        },
      ],
    }
  }
}

export function createProductionSocialContextProvider(
  options: ProductionSocialContextProviderOptions = {},
): ProductionSocialContextProvider {
  return new ProductionSocialContextProvider(options)
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
    limitations.push(`social ${label} unavailable for this request`)
    return fallback
  }
}

function accountSort(a: SocialAccount, b: SocialAccount): number {
  return a.brand.localeCompare(b.brand)
    || a.platform.localeCompare(b.platform)
    || a.displayName.localeCompare(b.displayName)
    || a.id.localeCompare(b.id)
}

function accountEvidence(account: SocialAccount): EvidenceRef {
  return {
    id: `social-account:${account.id}`,
    source: "social-account",
    observedAt: account.updatedAt,
    summary: [
      `${account.displayName} is a ${account.status} ${account.platform} account`,
      `brand=${account.brand}`,
      `provider=${account.provider}`,
      account.handle ? `handle=@${account.handle.replace(/^@/, "")}` : null,
      `accountId=${account.id}`,
    ].filter(Boolean).join("; "),
    immutable: false,
  }
}

function characterEvidence(
  profile: ReturnType<typeof listSocialCharacterProfiles>[number],
  observedAt: string,
): EvidenceRef {
  return {
    id: profile.id,
    source: "social-character-registry",
    observedAt,
    summary: [
      `${profile.label} character personality`,
      `brand=${profile.brand}`,
      `voice=${profile.voiceProfileRef}`,
      `tone=${profile.toneTraits.join(", ")}`,
      `pointOfView=${profile.pointOfView}`,
      "authority=EXPRESSION_ONLY",
    ].join("; "),
    immutable: true,
  }
}

function buildPendingWork(
  proposals: readonly SocialPublicationProposal[],
  outbox: readonly SocialOutboxJob[],
): EvidenceRef[] {
  const refs: EvidenceRef[] = []

  for (const proposal of proposals) {
    if (!["pending_approval", "approved", "queued", "partially_delivered", "failed"].includes(proposal.status)) continue
    refs.push({
      id: `social-proposal:${proposal.id}`,
      source: "social-publication",
      observedAt: proposal.updatedAt,
      summary: [
        `publication status=${proposal.status}`,
        `brand=${proposal.brand}`,
        `targets=${proposal.targets.map((target) => `${target.platform}:${target.accountId}`).join(",") || "none"}`,
        proposal.scheduledAt ? `scheduledAt=${proposal.scheduledAt}` : null,
        `proposalId=${proposal.id}`,
      ].filter(Boolean).join("; "),
      immutable: false,
    })
  }

  for (const job of outbox) {
    if (!["failed", "ambiguous", "attempting"].includes(job.status)) continue
    refs.push({
      id: `social-outbox:${job.id}`,
      source: "social-outbox",
      observedAt: job.updatedAt,
      summary: [
        `delivery status=${job.status}`,
        `platform=${job.target.platform}`,
        `accountId=${job.target.accountId}`,
        `proposalId=${job.proposalId}`,
        job.lastError ? `error=${job.lastError}` : null,
      ].filter(Boolean).join("; "),
      immutable: false,
    })
  }

  return refs.sort((a, b) => b.observedAt.localeCompare(a.observedAt) || a.id.localeCompare(b.id))
}

function performanceEvidence(observation: SocialObservation): EvidenceRef {
  const metrics = Object.entries(observation.metrics ?? {})
    .filter(([, value]) => Number.isFinite(value))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${name}=${value}`)
    .join(", ")

  return {
    id: `social-performance:${observation.id}`,
    source: observation.source,
    observedAt: observation.observedAt,
    summary: [
      `platform=${observation.platform}`,
      observation.accountId ? `accountId=${observation.accountId}` : null,
      observation.contentId ? `contentId=${observation.contentId}` : null,
      metrics || "metrics unavailable",
    ].filter(Boolean).join("; "),
    immutable: true,
  }
}

function buildAttentionEvidence(
  accounts: readonly SocialAccount[],
  proposals: readonly SocialPublicationProposal[],
  outbox: readonly SocialOutboxJob[],
  observations: readonly SocialObservation[],
  now: Date,
): EvidenceRef[] {
  return accounts
    .map((account) => {
      const reasons: string[] = []
      let score = 0

      const accountOutbox = outbox.filter((job) => job.target.accountId === account.id)
      const failed = accountOutbox.filter((job) => job.status === "failed" || job.status === "ambiguous")
      if (failed.length) {
        score += 60
        reasons.push(`${failed.length} failed/ambiguous delivery job(s)`)
      }

      const pending = proposals.filter((proposal) =>
        proposal.targets.some((target) => target.accountId === account.id)
        && proposal.status === "pending_approval",
      )
      if (pending.length) {
        score += 30
        reasons.push(`${pending.length} publication proposal(s) awaiting approval`)
      }

      const perf = observations
        .filter((observation) => observation.accountId === account.id && observation.kind === "performance")
        .sort((a, b) => b.observedAt.localeCompare(a.observedAt))

      if (!perf.length) {
        score += 20
        reasons.push("no performance observation available")
      } else {
        const ageDays = Math.max(0, (now.getTime() - Date.parse(perf[0]!.observedAt)) / 86_400_000)
        if (Number.isFinite(ageDays) && ageDays > 14) {
          score += 10
          reasons.push(`latest performance observation is ${Math.floor(ageDays)} day(s) old`)
        }
      }

      if (!reasons.length) reasons.push("no operational exception detected")

      return {
        score,
        ref: {
          id: `social-attention:${account.id}`,
          source: "social-attention",
          observedAt: now.toISOString(),
          summary: [
            `attentionScore=${score}`,
            `accountId=${account.id}`,
            `brand=${account.brand}`,
            `platform=${account.platform}`,
            `name=${account.displayName}`,
            `reasons=${reasons.join(" | ")}`,
          ].join("; "),
          immutable: false,
        } satisfies EvidenceRef,
      }
    })
    .sort((a, b) => b.score - a.score || a.ref.id.localeCompare(b.ref.id))
    .map((entry) => entry.ref)
}
