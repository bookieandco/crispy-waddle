import type { ContextPacket, EvidenceRef, PatternObservation, PersonalityState, RegretContext } from "@jhadina/core-spine"
import { JHADINA_BASE_SECURITY_POLICY, type SecurityPolicy } from "@jhadina/security-core"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { TimelineRepository } from "../repositories/TimelineRepository"
import type { Memory, TimelineEvent } from "../storage/InMemoryStorage"
import { getWorld, type JhadinaWorldId } from "../jhadina/jhadina-world-registry"
import type { JanetRegretContextProvider } from "../intelligence/janet-regret-context"
import { redactSecrets } from "./redact"

export interface ContextBuilderLimits {
  maxMemories: number
  maxRecentApprovals: number
  maxRegrets: number
  maxTotalChars: number
}

export const DEFAULT_CONTEXT_BUILDER_LIMITS: ContextBuilderLimits = {
  maxMemories: 5,
  maxRecentApprovals: 5,
  maxRegrets: 5,
  maxTotalChars: 4000,
}

export interface ContextBuilderInput {
  userId: string
  activeTask: string
  surface?: JhadinaWorldId
  route?: string
  activeProject?: string
  memoryRelevanceQuery?: string
  regretRelevanceQuery?: string
  limits?: Partial<ContextBuilderLimits>
}

export interface ContextBuilderDeps {
  memoryRepo: MemoryRepository
  timelineRepo: TimelineRepository
  policy?: SecurityPolicy
  /** Optional: absence preserves existing behavior; this provider is context-only. */
  regretContextProvider?: JanetRegretContextProvider
}

export interface AssembledContext {
  contextPacket: ContextPacket
  userId: string
  surface?: JhadinaWorldId
  route?: string
  activeTask: string
  activeProject?: string
  assembledAt: string
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

function emptyPersonalityState(): PersonalityState {
  return { version: 0, traits: [], independentAssessmentRequired: true, updatedAt: new Date(0).toISOString() }
}

function toRegretContext(result: Awaited<ReturnType<JanetRegretContextProvider["getRegretContext"]>>["regrets"][number]): RegretContext {
  return {
    memoryId: result.memoryId,
    score: result.score,
    subjectType: result.record.regret.subjectType,
    subjectId: result.record.regret.subjectId,
    discrepancy: result.record.regret.discrepancy,
    rootCause: result.record.regret.rootCause,
    recurrenceCount: result.record.regret.recurrenceCount,
    status: result.record.regret.status,
    salience: result.record.salience,
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

  let regretContext: RegretContext[] = []
  if (deps.regretContextProvider) {
    const regretQuery = input.regretRelevanceQuery ?? input.memoryRelevanceQuery ?? input.activeTask
    const regretRecall = await deps.regretContextProvider.getRegretContext({ userId: input.userId, query: regretQuery, limit: limits.maxRegrets })
    regretContext = regretRecall.regrets.slice(0, limits.maxRegrets).map(toRegretContext)
    if (regretRecall.regrets.length > regretContext.length) excludedContext.push(`${regretRecall.regrets.length - regretContext.length} regret signal(s) excluded past the maxRegrets limit (${limits.maxRegrets})`)
  } else {
    excludedContext.push("regrets: not assembled — no RegretContextProvider supplied")
  }

  const world = input.surface ? getWorld(input.surface) : undefined
  if (input.surface && !world) excludedContext.push(`surface "${input.surface}" not found in the world registry`)
  if (!input.surface) excludedContext.push("surface: not supplied by the caller")
  if (!input.route) excludedContext.push("route: not supplied by the caller")
  if (!input.activeProject) excludedContext.push("activeProject: not supplied — no Project/Workspace entity exists in this repository yet")
  excludedContext.push("patterns: not assembled — no PatternPort implementation exists yet")
  excludedContext.push("personality: not assembled — no PersonalityPort implementation exists yet")

  const { redacted: redactedActiveTask, redactionCount: taskRedactions } = redactSecrets(input.activeTask)
  totalRedactions += taskRedactions

  let knowledgeRefs = approvalRefs.map((r) => r.ref)
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

  const surfaceLabel = world?.label ?? input.surface
  const purposeParts = ["Ask Jhadina request"]
  if (surfaceLabel) purposeParts.push(`on ${surfaceLabel}`)
  if (input.route) purposeParts.push(`(${input.route})`)

  const contextPacket: ContextPacket = {
    id: `ctx_${crypto.randomUUID()}`,
    purpose: purposeParts.join(" "),
    userGoal: redactedActiveTask,
    relevantMemories: memoryEvidenceRefs,
    patterns: [] as PatternObservation[],
    personality: emptyPersonalityState(),
    knowledge: knowledgeRefs,
    regretContext,
    constraints: policyConstraints(policy),
    excludedContext,
  }

  return { contextPacket, userId: input.userId, surface: input.surface, route: input.route, activeTask: redactedActiveTask, activeProject: input.activeProject, assembledAt: new Date().toISOString() }
}
