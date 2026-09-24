import {
  emptyPersonalityState,
  type BehavioralKernelContext,
  type ContextPacket,
  type ConversationSignalContext,
  type DomainContext,
  type EvidenceRef,
  type EphemeralArtifactContext,
  type ExpressionDirective,
  type GrowthDomainContext,
  type LiveContextContribution,
  type OwnerContextContribution,
  type PatternObservation,
  type PersonalityState,
  type SocialDomainContext,
  type SpatialDomainContext,
} from "@jhadina/core-spine"
import { JHADINA_BASE_SECURITY_POLICY, type SecurityPolicy } from "@jhadina/security-core"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { TimelineRepository } from "../repositories/TimelineRepository"
import type { Memory, TimelineEvent } from "../storage/InMemoryStorage"
import { getWorld, type JhadinaWorldId } from "../jhadina/jhadina-world-registry"
import { redactSecrets } from "./redact"

/** Provider-neutral, read-only spatial contribution. The provider cannot mutate ContextPacket or reality. */
export interface SpatialContextProvider {
  getContext(input: {
    userId: string
    activeTask: string
    geographicScope?: unknown
    temporalScope?: { from: string | null; to: string | null; asOf: string | null }
  }): Promise<SpatialDomainContext | undefined>
}

export interface GrowthContextProvider {
  getContext(input: {
    userId: string
    activeTask: string
  }): Promise<GrowthDomainContext | undefined>
}

export interface SocialContextProvider {
  getContext(input: {
    userId: string
    activeTask: string
  }): Promise<SocialDomainContext | undefined>
}

export interface PersonalityContextProvider {
  getContext(input: {
    userId: string
    activeTask: string
    behaviorContext?: BehavioralKernelContext
  }): Promise<{
    patterns: PatternObservation[]
    personality: PersonalityState
    expressionDirective: ExpressionDirective
    limitations: string[]
  }>
}

export interface KnowledgeContextProvider {
  getContext(input: {
    userId: string
    activeTask: string
  }): Promise<{
    knowledge: EvidenceRef[]
    limitations: string[]
  }>
}

export interface OwnerContextProvider {
  getContext(input: {
    userId: string
    activeTask: string
  }): Promise<OwnerContextContribution | undefined>
}

export interface ContextBuilderLimits {
  maxMemories: number
  maxRecentApprovals: number
  maxTotalChars: number
}

export const DEFAULT_CONTEXT_BUILDER_LIMITS: ContextBuilderLimits = {
  maxMemories: 5,
  maxRecentApprovals: 5,
  maxTotalChars: 4000,
}

export interface ContextBuilderInput {
  userId: string
  activeTask: string
  surface?: JhadinaWorldId
  route?: string
  activeProject?: string
  memoryRelevanceQuery?: string
  geographicScope?: unknown
  temporalScope?: { from: string | null; to: string | null; asOf: string | null }
  artifacts?: EphemeralArtifactContext[]
  conversationSignals?: ConversationSignalContext
  liveContext?: LiveContextContribution
  behaviorContext?: BehavioralKernelContext
  limits?: Partial<ContextBuilderLimits>
}

export interface ContextBuilderDeps {
  memoryRepo: MemoryRepository
  timelineRepo: TimelineRepository
  policy?: SecurityPolicy
  /** Optional spatial intelligence read adapter. Omitted means no spatial context is assembled. */
  spatialContextProvider?: SpatialContextProvider
  /** Optional governed personality read/projection adapter. No provider means canonical empty fallback. */
  personalityContextProvider?: PersonalityContextProvider
  /** Optional read-only canonical Knowledge Graph adapter. It grants no admission or mutation authority. */
  knowledgeContextProvider?: KnowledgeContextProvider
  /** Optional provenance-aware owner/public-context adapter. It cannot write Memory or Personality. */
  ownerContextProvider?: OwnerContextProvider
  /** Optional read-only Social context adapter. It cannot publish or mutate account state. */
  socialContextProvider?: SocialContextProvider
  /** Optional read-only Growth context adapter. It cannot spend, publish, send lifecycle actions, or mutate audiences. */
  growthContextProvider?: GrowthContextProvider
}

export interface AssembledContext {
  contextPacket: ContextPacket
  userId: string
  surface?: JhadinaWorldId
  route?: string
  activeTask: string
  activeProject?: string
  behaviorContext: BehavioralKernelContext
  assembledAt: string
}

export function deriveBehaviorContext(activeTask: string): BehavioralKernelContext {
  const text = activeTask.toLowerCase()
  const serious = /\b(emergency|urgent|danger|dangerous|safety|critical|crisis|serious)\b/.test(text)
  const distress = /\b(panic|terrified|suicid|self-harm|grief|griev(?:e|ed|ing)?|bereav(?:e|ed|ement|ing)?|abuse|assault|overdose)\b/.test(text)
  const requiresPrecision = /\b(exact|exactly|precise|precision|verify|verified|audit|certif(?:y|ication)|calculate|calculation|compliance|legal requirement|source|citation)\b/.test(text)
  const highStakes = /\b(medical|clinical|diagnos|medication|legal|lawsuit|financial advice|emergency|safety|self-harm|hallucinat|sleep deprivation|hyperventilat|prolonged breath)\b/.test(text)
  const userAskedForPushback = /\b(push back|challenge me|disagree with me|tell me if i'?m wrong)\b/.test(text)
  const disagreementDetected = /\b(i disagree|that'?s wrong|you'?re wrong|not what i said|incorrect)\b/.test(text)
  const ambiguity = /\b(unclear|not sure what|which one do you mean|ambiguous|confused about which)\b/.test(text) ? 0.8 : 0
  const operationalContext = /\b(activate|launch|pre-launch|deploy|runtime|protocol|sequence|system|ops|operation)\b/.test(text)
  const intimacyEligible = /\b(relationship|romance|dating|intimacy|sexual|sex|partner|marriage)\b/.test(text) && !highStakes && !distress
  const symbolicFramingEligible = /\b(spiritual|tarot|symbol|synchronic|soul|transformation|letting go|myth|anunnaki|alien|paranormal|anomaly|aura|pineal|third eye|energy field)\b/.test(text)
  const banterEligible = !highStakes && !distress
  const conversationTemperature = /\b(joke|funny|roast|banter|playful)\b/.test(text)
    ? 0.8
    : /\b(grief|griev(?:e|ed|ing)?|bereav(?:e|ed|ement|ing)?|hurt|upset|angry|crisis|trauma)\b/.test(text)
      ? 0.2
      : 0.5
  const workloadPressure = /\b(urgent|deadline|launch|deploy|ship|production|incident)\b/.test(text) ? 0.75 : 0.2

  const register: BehavioralKernelContext["register"] =
    /\b(medical|clinical|diagnos|medication|psychiatr|symptom)\b/.test(text)
      ? "clinical"
      : /\b(aura|afterimage|after-image|hallucinat|vision|visions|sleep deprivation|breathwork|hyperventilat|pineal|third eye|peripheral vision|altered perception|geometric patterns)\b/.test(text)
        ? "perceptual-inquiry"
        : /\b(anunnaki|ufo|alien|paranormal|myth|conspiracy|anomaly)\b/.test(text)
          ? "mythic-inquiry"
          : /\b(tarot|soulmate|soul bond|spiritual love|relationship reading)\b/.test(text)
          ? "sacred-love"
          : /\b(transformation|letting go|transition|becoming|reinvent|shame release)\b/.test(text)
            ? "threshold"
            : /\b(investigat|timeline|provenance|connection|network trace|evidence trail)\b/.test(text)
              ? "investigative"
              : intimacyEligible && /\b(intimacy|sexual|sex|dating|partner|relationship|marriage|fantasy|bedroom)\b/.test(text)
                ? "intimacy-agency"
                : /\b(viral|clip|post|comments|social media|tiktok|instagram|reel|timeline reaction|react to)\b/.test(text)
                  ? "social-reaction"
                  : /\b(music history|artist legacy|legacy|album|discography|hip[- ]?hop history|cultural impact|influence on culture|give .* flowers)\b/.test(text)
                    ? "cultural-salon"
                    : /\b(audience|callers|community discussion|roundtable|panel discussion|room discussion)\b/.test(text)
                      ? "community-room"
                      : /\b(tell me a story|storytime|story time|long-form story|recount the story|narrative)\b/.test(text)
                        ? "storytelling"
                        : /\b(reflect|sit with this|think this through|what does this mean to me|process this with me)\b/.test(text)
                          ? "reflective"
                          : /\b(joke|funny|roast|banter|playful)\b/.test(text)
                            ? "playful"
                            : operationalContext && !requiresPrecision && !serious
                              ? "household-ops"
                              : "default"

  return {
    serious,
    distress,
    highStakes,
    requiresPrecision,
    userAskedForPushback,
    disagreementDetected,
    ambiguity,
    register,
    banterEligible,
    symbolicFramingEligible,
    intimacyEligible,
    operationalContext,
    conversationTemperature,
    workloadPressure,
  }
}

function extractKeywords(text: string): string[] {
  return Array.from(new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 4)))
}

function isRelevant(content: string, keywords: string[]): boolean {
  if (keywords.length === 0) return false
  const lower = content.toLowerCase()
  return keywords.some((keyword) => lower.includes(keyword))
}

function sortMemoriesDeterministically(memories: Memory[]): Memory[] {
  return [...memories].sort((a, b) => {
    const aDate = a.approvedAt ?? a.createdAt
    const bDate = b.approvedAt ?? b.createdAt
    const byDate = bDate.localeCompare(aDate)
    return byDate !== 0 ? byDate : a.id.localeCompare(b.id)
  })
}

function sortTimelineDeterministically(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((a, b) => {
    const byDate = b.timestamp.localeCompare(a.timestamp)
    return byDate !== 0 ? byDate : a.id.localeCompare(b.id)
  })
}

function memoryToEvidenceRef(memory: Memory): { ref: EvidenceRef; redactionCount: number } {
  const { redacted, redactionCount } = redactSecrets(memory.content)
  return {
    ref: { id: memory.id, source: "memory-core", observedAt: memory.approvedAt ?? memory.createdAt, summary: redacted, immutable: false },
    redactionCount,
  }
}

function approvalToEvidenceRef(event: TimelineEvent): { ref: EvidenceRef; redactionCount: number } {
  const rawSummary = `${event.memoryType ?? "memory"} approved: ${event.memoryContent ?? ""}`
  const { redacted, redactionCount } = redactSecrets(rawSummary)
  return {
    ref: { id: event.id, source: "timeline-approval", observedAt: event.timestamp, summary: redacted, immutable: true },
    redactionCount,
  }
}

function policyConstraints(policy: SecurityPolicy): string[] {
  const constraints = policy.allowedCapabilities.map((capability) =>
    policy.approvalCapabilities.includes(capability)
      ? `allowed: ${capability} (requires explicit approval)`
      : `allowed: ${capability}`,
  )
  for (const denied of policy.deniedCapabilities ?? []) constraints.push(`denied: ${denied}`)
  return constraints
}

function normalizeOwnerContext(owner: OwnerContextContribution): OwnerContextContribution {
  return {
    ...(owner.hub ? { hub: owner.hub } : {}),
    references: owner.references.map((reference) => ({
      ...reference,
      evidence: { ...reference.evidence },
    })),
    limitations: [...owner.limitations],
  }
}

function normalizeGrowthContext(growth: GrowthDomainContext): GrowthDomainContext {
  const copyRefs = (refs: EvidenceRef[]) => refs.map((ref) => ({ ...ref }))
  return {
    campaigns: copyRefs(growth.campaigns),
    audiences: copyRefs(growth.audiences),
    pendingWork: copyRefs(growth.pendingWork),
    performance: copyRefs(growth.performance),
    attention: copyRefs(growth.attention),
    uncertainty: [...growth.uncertainty],
    limitations: [...growth.limitations],
    provenance: copyRefs(growth.provenance),
  }
}

function normalizeSocialContext(social: SocialDomainContext): SocialDomainContext {
  const copyRefs = (refs: EvidenceRef[]) => refs.map((ref) => ({ ...ref }))
  return {
    accounts: copyRefs(social.accounts),
    characters: copyRefs(social.characters),
    pendingWork: copyRefs(social.pendingWork),
    performance: copyRefs(social.performance),
    attention: copyRefs(social.attention),
    uncertainty: [...social.uncertainty],
    limitations: [...social.limitations],
    provenance: copyRefs(social.provenance),
  }
}

function normalizeSpatialContext(spatial: SpatialDomainContext): SpatialDomainContext {
  const copyRefs = (refs: EvidenceRef[]) => refs.map((ref) => ({ ...ref }))
  return {
    observations: copyRefs(spatial.observations),
    evidence: copyRefs(spatial.evidence),
    claims: copyRefs(spatial.claims),
    reality: copyRefs(spatial.reality),
    attention: copyRefs(spatial.attention),
    conflicts: [...spatial.conflicts],
    uncertainty: [...spatial.uncertainty],
    limitations: [...spatial.limitations],
    provenance: copyRefs(spatial.provenance),
  }
}

export async function buildContext(deps: ContextBuilderDeps, input: ContextBuilderInput): Promise<AssembledContext> {
  const limits: ContextBuilderLimits = { ...DEFAULT_CONTEXT_BUILDER_LIMITS, ...input.limits }
  const policy = deps.policy ?? JHADINA_BASE_SECURITY_POLICY
  const excludedContext: string[] = []
  let totalRedactions = 0

  const allApproved = await deps.memoryRepo.listApproved(input.userId)
  const keywords = extractKeywords(input.memoryRelevanceQuery ?? input.activeTask)
  const relevantMemories = sortMemoriesDeterministically(allApproved.filter((m) => isRelevant(m.content, keywords)))
  const excludedMemoryCount = allApproved.length - relevantMemories.length
  if (excludedMemoryCount > 0) excludedContext.push(`${excludedMemoryCount} of ${allApproved.length} approved ${allApproved.length === 1 ? "memory" : "memories"} excluded as not relevant to the current request`)
  const boundedMemories = relevantMemories.slice(0, limits.maxMemories)
  if (relevantMemories.length > boundedMemories.length) excludedContext.push(`${relevantMemories.length - boundedMemories.length} relevant ${relevantMemories.length - boundedMemories.length === 1 ? "memory" : "memories"} excluded past the maxMemories limit (${limits.maxMemories})`)
  const memoryRefs = boundedMemories.map(memoryToEvidenceRef)
  totalRedactions += memoryRefs.reduce((sum, r) => sum + r.redactionCount, 0)

  const timeline = await deps.timelineRepo.list(input.userId, Math.max(limits.maxRecentApprovals * 10, 50))
  const approvals = sortTimelineDeterministically(timeline.filter((e) => e.type === "APPROVAL"))
  const boundedApprovals = approvals.slice(0, limits.maxRecentApprovals)
  if (approvals.length > boundedApprovals.length) excludedContext.push(`${approvals.length - boundedApprovals.length} recent approved ${approvals.length - boundedApprovals.length === 1 ? "observation" : "observations"} excluded past the maxRecentApprovals limit (${limits.maxRecentApprovals})`)
  const approvalRefs = boundedApprovals.map(approvalToEvidenceRef)
  totalRedactions += approvalRefs.reduce((sum, r) => sum + r.redactionCount, 0)

  const world = input.surface ? getWorld(input.surface) : undefined
  if (input.surface && !world) excludedContext.push(`surface "${input.surface}" not found in the world registry`)
  if (!input.surface) excludedContext.push("surface: not supplied by the caller")
  if (!input.route) excludedContext.push("route: not supplied by the caller")
  if (!input.activeProject) excludedContext.push("activeProject: not supplied — no Project/Workspace entity exists in this repository yet")

  const { redacted: redactedActiveTask, redactionCount: taskRedactions } = redactSecrets(input.activeTask)
  totalRedactions += taskRedactions
  const behaviorContext = input.behaviorContext ?? deriveBehaviorContext(redactedActiveTask)

  let patterns: PatternObservation[] = []
  let personality = emptyPersonalityState(new Date(0).toISOString())
  let expressionDirective: ExpressionDirective | undefined

  if (deps.personalityContextProvider) {
    try {
      const contribution = await deps.personalityContextProvider.getContext({
        userId: input.userId,
        activeTask: redactedActiveTask,
        behaviorContext,
      })
      patterns = contribution.patterns.map((pattern) => ({
        ...pattern,
        evidence: pattern.evidence.map((ref) => ({ ...ref })),
        contradictions: pattern.contradictions.map((ref) => ({ ...ref })),
      }))
      personality = structuredClone(contribution.personality)
      expressionDirective = structuredClone(contribution.expressionDirective)
      excludedContext.push(...contribution.limitations)
    } catch {
      excludedContext.push(
        "personality: governed context unavailable — canonical empty state used",
      )
    }
  } else {
    excludedContext.push("patterns: not assembled — PatternPort is not composed into the direct context fallback")
    excludedContext.push("personality: not assembled — direct context fallback uses canonical empty state until governed ports are composed")
  }

  let knowledgeRefs = approvalRefs.map((r) => r.ref)
  if (deps.knowledgeContextProvider) {
    try {
      const contribution = await deps.knowledgeContextProvider.getContext({
        userId: input.userId,
        activeTask: redactedActiveTask,
      })
      const byId = new Map<string, EvidenceRef>()
      for (const ref of [...contribution.knowledge, ...knowledgeRefs]) {
        if (!byId.has(ref.id)) byId.set(ref.id, { ...ref })
      }
      knowledgeRefs = [...byId.values()]
      excludedContext.push(...contribution.limitations.map((item) => `knowledge: ${item}`))
    } catch {
      excludedContext.push("knowledge: canonical Knowledge Graph context unavailable")
    }
  } else {
    excludedContext.push("knowledge: canonical Knowledge Graph provider not composed; recent approval evidence only")
  }

  let ownerContext: OwnerContextContribution | undefined
  if (deps.ownerContextProvider) {
    try {
      const contribution = await deps.ownerContextProvider.getContext({
        userId: input.userId,
        activeTask: redactedActiveTask,
      })
      if (contribution) {
        ownerContext = normalizeOwnerContext(contribution)
        const byId = new Map(knowledgeRefs.map((ref) => [ref.id, ref]))
        for (const reference of ownerContext.references) {
          if (!byId.has(reference.evidence.id)) byId.set(reference.evidence.id, { ...reference.evidence })
        }
        knowledgeRefs = [...byId.values()]
        excludedContext.push(...ownerContext.limitations.map((item) => `owner-context: ${item}`))
      }
    } catch {
      excludedContext.push("owner-context: governed public context unavailable")
    }
  }

  let memoryEvidenceRefs = memoryRefs.map((r) => r.ref)
  const textLength = (refs: EvidenceRef[]) => refs.reduce((sum, r) => sum + r.summary.length, 0)
  let trimmed = 0
  while (redactedActiveTask.length + textLength(memoryEvidenceRefs) + textLength(knowledgeRefs) > limits.maxTotalChars && (memoryEvidenceRefs.length > 0 || knowledgeRefs.length > 0)) {
    if (knowledgeRefs.length >= memoryEvidenceRefs.length && knowledgeRefs.length > 0) knowledgeRefs = knowledgeRefs.slice(0, -1)
    else memoryEvidenceRefs = memoryEvidenceRefs.slice(0, -1)
    trimmed += 1
  }
  if (trimmed > 0) excludedContext.push(`${trimmed} item(s) trimmed to stay within the ${limits.maxTotalChars}-character budget`)
  if (totalRedactions > 0) excludedContext.push(`${totalRedactions} secret-like pattern(s) redacted from assembled text`)

  let domainContext: DomainContext | undefined
  if (deps.spatialContextProvider) {
    const spatial = await deps.spatialContextProvider.getContext({
      userId: input.userId,
      activeTask: redactedActiveTask,
      geographicScope: input.geographicScope,
      temporalScope: input.temporalScope,
    })
    if (spatial) domainContext = { ...(domainContext ?? {}), spatial: normalizeSpatialContext(spatial) }
  }
  if (deps.socialContextProvider) {
    try {
      const social = await deps.socialContextProvider.getContext({
        userId: input.userId,
        activeTask: redactedActiveTask,
      })
      if (social) {
        domainContext = { ...(domainContext ?? {}), social: normalizeSocialContext(social) }
        excludedContext.push(...social.limitations.map((item) => `social: ${item}`))
      }
    } catch {
      excludedContext.push("social: governed context unavailable")
    }
  }
  if (deps.growthContextProvider) {
    try {
      const growth = await deps.growthContextProvider.getContext({
        userId: input.userId,
        activeTask: redactedActiveTask,
      })
      if (growth) {
        domainContext = { ...(domainContext ?? {}), growth: normalizeGrowthContext(growth) }
        excludedContext.push(...growth.limitations.map((item) => `growth: ${item}`))
      }
    } catch {
      excludedContext.push("growth: governed context unavailable")
    }
  }

  const surfaceLabel = world?.label ?? input.surface
  const purposeParts = ["Ask Jhadina request"]
  if (surfaceLabel) purposeParts.push(`on ${surfaceLabel}`)
  if (input.route) purposeParts.push(`(${input.route})`)

  const contextPacket: ContextPacket = {
    id: `ctx_${crypto.randomUUID()}`,
    purpose: purposeParts.join(" "),
    userGoal: redactedActiveTask,
    relevantMemories: memoryEvidenceRefs,
    patterns,
    personality,
    knowledge: knowledgeRefs,
    constraints: policyConstraints(policy),
    excludedContext,
    ...(input.artifacts?.length ? { artifacts: input.artifacts.map((artifact) => ({ ...artifact })) } : {}),
    ...(input.conversationSignals ? { conversationSignals: structuredClone(input.conversationSignals) } : {}),
    ...(input.liveContext ? { liveContext: structuredClone(input.liveContext) } : {}),
    ...(ownerContext ? { ownerContext } : {}),
    ...(domainContext ? { domainContext } : {}),
    ...(expressionDirective ? { expressionDirective } : {}),
  }

  return {
    contextPacket,
    userId: input.userId,
    surface: input.surface,
    route: input.route,
    activeTask: redactedActiveTask,
    activeProject: input.activeProject,
    behaviorContext,
    assembledAt: new Date().toISOString(),
  }
}
