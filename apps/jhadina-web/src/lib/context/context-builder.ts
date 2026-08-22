import type { ContextPacket, EvidenceRef, PatternObservation, PersonalityState } from "@jhadina/core-spine"
import { JHADINA_BASE_SECURITY_POLICY, type SecurityPolicy } from "@jhadina/security-core"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { TimelineRepository } from "../repositories/TimelineRepository"
import type { Memory, TimelineEvent } from "../storage/InMemoryStorage"
import { getWorld, type JhadinaWorldId } from "../jhadina/jhadina-world-registry"
import { redactSecrets } from "./redact"

/**
 * Phase 1 Step 4 — Context Builder.
 *
 * Assembles a bounded, structured `ContextPacket` (core-spine's existing
 * type — unmodified, not duplicated) from the real data sources this
 * repository already has: Step 2's durable Memory Core
 * (`MemoryRepository`/`TimelineRepository`), security-core's real base
 * policy, and the existing `jhadina-world-registry` surface catalogue.
 * The output is exactly what `IntelligenceRouter.decide()` /
 * `DecisionPort.decide()` already consume — no adapter, no new shape.
 *
 * This module makes zero decisions and executes zero actions. It only
 * reads already-durable state and assembles it. Identity is not
 * verified here — `userId` is a trusted, already-verified input (the
 * same boundary Step 3's `governed-intelligence-proposal.ts` already
 * establishes before anything context-shaped runs).
 *
 * `ContextPort` (core-spine) is not implemented here. Its signature
 * takes pre-computed `MemoryProposal[]`/`PatternObservation[]`/
 * `PersonalityState` as input — i.e. it assumes `MemoryPort`/
 * `PatternPort`/`PersonalityPort` already ran. None of those three
 * ports have a real implementation anywhere in this repo yet (a real,
 * named gap, not fabricated here to satisfy the interface). Building a
 * `ContextPort` adapter is Step 5 work, once those ports are decided —
 * this function assembles a `ContextPacket` directly from real data
 * instead, which is what makes it usable by `IntelligenceRouter` today.
 */

export interface ContextBuilderLimits {
  /** Most relevant approved memories to include. */
  maxMemories: number
  /** Most recent approved-observation (Timeline APPROVAL) entries to include. */
  maxRecentApprovals: number
  /** Hard cap on the total character budget of all assembled free text (memory
   * summaries + timeline summaries + activeTask). Exceeding it trims the
   * lowest-priority (least recent) items first, not truncates mid-string. */
  maxTotalChars: number
}

export const DEFAULT_CONTEXT_BUILDER_LIMITS: ContextBuilderLimits = {
  maxMemories: 5,
  maxRecentApprovals: 5,
  maxTotalChars: 4000,
}

export interface ContextBuilderInput {
  /** Already-verified identity — this function does not verify it. */
  userId: string
  /** The current conversation/request turn being reasoned about. */
  activeTask: string
  /** Current surface/application, if known (see jhadina-world-registry.ts). */
  surface?: JhadinaWorldId
  /** Current route/page, if known — a raw path string, not validated against any router. */
  route?: string
  /** Active project/workspace, if known. No Project/Workspace entity exists
   * in this repository yet — when omitted, this is honestly recorded as
   * missing in `excludedContext`, never fabricated. */
  activeProject?: string
  /** Overrides the text used for memory-relevance matching. Defaults to `activeTask`. */
  memoryRelevanceQuery?: string
  limits?: Partial<ContextBuilderLimits>
}

export interface ContextBuilderDeps {
  memoryRepo: MemoryRepository
  timelineRepo: TimelineRepository
  /** Defaults to security-core's real base policy. */
  policy?: SecurityPolicy
}

export interface AssembledContext {
  /** Exactly what `IntelligenceRouter.decide()` / `DecisionPort.decide()` consume. */
  contextPacket: ContextPacket
  userId: string
  surface?: JhadinaWorldId
  route?: string
  activeTask: string
  activeProject?: string
  assembledAt: string
}

function extractKeywords(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length >= 4),
    ),
  )
}

function isRelevant(content: string, keywords: string[]): boolean {
  if (keywords.length === 0) return false
  const lower = content.toLowerCase()
  return keywords.some((keyword) => lower.includes(keyword))
}

/** Deterministic: most recently created/approved first, id as a stable tiebreaker. */
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
    ref: {
      id: memory.id,
      source: "memory-core",
      observedAt: memory.approvedAt ?? memory.createdAt,
      summary: redacted,
      immutable: false,
    },
    redactionCount,
  }
}

function approvalToEvidenceRef(event: TimelineEvent): { ref: EvidenceRef; redactionCount: number } {
  const rawSummary = `${event.memoryType ?? "memory"} approved: ${event.memoryContent ?? ""}`
  const { redacted, redactionCount } = redactSecrets(rawSummary)
  return {
    ref: {
      id: event.id,
      source: "timeline-approval",
      observedAt: event.timestamp,
      summary: redacted,
      immutable: true, // an approval, once recorded, is a historical fact
    },
    redactionCount,
  }
}

function policyConstraints(policy: SecurityPolicy): string[] {
  const constraints = policy.allowedCapabilities.map((capability) =>
    policy.approvalCapabilities.includes(capability)
      ? `allowed: ${capability} (requires explicit approval)`
      : `allowed: ${capability}`,
  )
  for (const denied of policy.deniedCapabilities ?? []) {
    constraints.push(`denied: ${denied}`)
  }
  return constraints
}

/** A never-real-yet PersonalityState, honestly flagged rather than faked. No PersonalityPort exists in this repository. */
function emptyPersonalityState(): PersonalityState {
  return {
    version: 0,
    traits: [],
    independentAssessmentRequired: true,
    updatedAt: new Date(0).toISOString(),
  }
}

/**
 * Assembles a bounded `ContextPacket`. Pure with respect to decisions —
 * this function only reads (`memoryRepo`/`timelineRepo`) and computes;
 * it writes nothing, executes nothing, and never throws on missing data
 * (a fresh user with no memories/timeline/surface/project is a normal,
 * fully-supported input, not an error).
 */
export async function buildContext(
  deps: ContextBuilderDeps,
  input: ContextBuilderInput,
): Promise<AssembledContext> {
  const limits: ContextBuilderLimits = { ...DEFAULT_CONTEXT_BUILDER_LIMITS, ...input.limits }
  const policy = deps.policy ?? JHADINA_BASE_SECURITY_POLICY
  const excludedContext: string[] = []
  let totalRedactions = 0

  // -- Relevant durable memories -------------------------------------
  const allApproved = await deps.memoryRepo.listApproved(input.userId)
  const keywords = extractKeywords(input.memoryRelevanceQuery ?? input.activeTask)
  const relevantMemories = sortMemoriesDeterministically(allApproved.filter((m) => isRelevant(m.content, keywords)))
  const excludedMemoryCount = allApproved.length - relevantMemories.length
  if (excludedMemoryCount > 0) {
    excludedContext.push(
      `${excludedMemoryCount} of ${allApproved.length} approved ${allApproved.length === 1 ? "memory" : "memories"} excluded as not relevant to the current request`,
    )
  }
  const boundedMemories = relevantMemories.slice(0, limits.maxMemories)
  if (relevantMemories.length > boundedMemories.length) {
    excludedContext.push(
      `${relevantMemories.length - boundedMemories.length} relevant ${relevantMemories.length - boundedMemories.length === 1 ? "memory" : "memories"} excluded past the maxMemories limit (${limits.maxMemories})`,
    )
  }
  const memoryRefs = boundedMemories.map(memoryToEvidenceRef)
  totalRedactions += memoryRefs.reduce((sum, r) => sum + r.redactionCount, 0)

  // -- Recent approved observations (Timeline APPROVAL entries) ------
  const timeline = await deps.timelineRepo.list(input.userId, Math.max(limits.maxRecentApprovals * 10, 50))
  const approvals = sortTimelineDeterministically(timeline.filter((e) => e.type === "APPROVAL"))
  const boundedApprovals = approvals.slice(0, limits.maxRecentApprovals)
  if (approvals.length > boundedApprovals.length) {
    excludedContext.push(
      `${approvals.length - boundedApprovals.length} recent approved ${approvals.length - boundedApprovals.length === 1 ? "observation" : "observations"} excluded past the maxRecentApprovals limit (${limits.maxRecentApprovals})`,
    )
  }
  const approvalRefs = boundedApprovals.map(approvalToEvidenceRef)
  totalRedactions += approvalRefs.reduce((sum, r) => sum + r.redactionCount, 0)

  // -- Surface / project bookkeeping ---------------------------------
  const world = input.surface ? getWorld(input.surface) : undefined
  if (input.surface && !world) {
    excludedContext.push(`surface "${input.surface}" not found in the world registry`)
  }
  if (!input.surface) {
    excludedContext.push("surface: not supplied by the caller")
  }
  if (!input.route) {
    excludedContext.push("route: not supplied by the caller")
  }
  if (!input.activeProject) {
    excludedContext.push("activeProject: not supplied — no Project/Workspace entity exists in this repository yet")
  }

  // -- Not-yet-real ports, honestly named, not fabricated ------------
  excludedContext.push("patterns: not assembled — no PatternPort implementation exists yet")
  excludedContext.push("personality: not assembled — no PersonalityPort implementation exists yet")

  const { redacted: redactedActiveTask, redactionCount: taskRedactions } = redactSecrets(input.activeTask)
  totalRedactions += taskRedactions

  // -- Character budget: trim least-recent items first until in budget --
  let knowledgeRefs = approvalRefs.map((r) => r.ref)
  let memoryEvidenceRefs = memoryRefs.map((r) => r.ref)
  const textLength = (refs: EvidenceRef[]) => refs.reduce((sum, r) => sum + r.summary.length, 0)
  let trimmed = 0
  while (
    redactedActiveTask.length + textLength(memoryEvidenceRefs) + textLength(knowledgeRefs) > limits.maxTotalChars &&
    (memoryEvidenceRefs.length > 0 || knowledgeRefs.length > 0)
  ) {
    // Drop the least-recent item across both lists (they're each already
    // sorted most-recent-first, so the tail of whichever list is longer
    // is always the lowest priority).
    if (knowledgeRefs.length >= memoryEvidenceRefs.length && knowledgeRefs.length > 0) {
      knowledgeRefs = knowledgeRefs.slice(0, -1)
    } else {
      memoryEvidenceRefs = memoryEvidenceRefs.slice(0, -1)
    }
    trimmed += 1
  }
  if (trimmed > 0) {
    excludedContext.push(`${trimmed} item(s) trimmed to stay within the ${limits.maxTotalChars}-character budget`)
  }

  if (totalRedactions > 0) {
    excludedContext.push(`${totalRedactions} secret-like pattern(s) redacted from assembled text`)
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
    patterns: [] as PatternObservation[],
    personality: emptyPersonalityState(),
    knowledge: knowledgeRefs,
    constraints: policyConstraints(policy),
    excludedContext,
  }

  return {
    contextPacket,
    userId: input.userId,
    surface: input.surface,
    route: input.route,
    activeTask: redactedActiveTask,
    activeProject: input.activeProject,
    assembledAt: new Date().toISOString(),
  }
}
