import type {
  ContextPacket,
  EvidenceRef,
  Experience,
  PatternObservation,
  PersonalityState,
} from "@jhadina/core-spine"
import { redactContextText } from "./redact"

export interface ContextMemory {
  id: string
  content: string
  createdAt?: string
  confidence?: number
}

export interface ContextObservation {
  id: string
  content: string
  occurredAt: string
  source: string
}

export interface ContextSurface {
  world?: string
  route?: string
  project?: string
}

export interface ContextBuilderInput {
  purpose: string
  experience: Experience
  memories?: ContextMemory[]
  observations?: ContextObservation[]
  patterns?: PatternObservation[]
  personality?: PersonalityState
  knowledge?: EvidenceRef[]
  constraints?: string[]
  surface?: ContextSurface
  userGoal?: string
  maxItems?: number
  maxCharacters?: number
}

const DEFAULT_MAX_ITEMS = 24
const DEFAULT_MAX_CHARACTERS = 12000

function words(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2),
  )
}

function relevance(query: string, text: string): number {
  const queryWords = words(query)
  if (!queryWords.size) return 0
  let score = 0
  for (const word of words(text)) if (queryWords.has(word)) score += 1
  return score
}

function memoryEvidence(memory: ContextMemory): EvidenceRef {
  return {
    id: memory.id,
    source: "memory",
    observedAt: memory.createdAt ?? new Date(0).toISOString(),
    summary: redactContextText(memory.content),
  }
}

function observationEvidence(observation: ContextObservation): EvidenceRef {
  return {
    id: observation.id,
    source: observation.source,
    observedAt: observation.occurredAt,
    summary: redactContextText(observation.content),
  }
}

/**
 * Pure context assembly. It retrieves no model output, makes no decisions,
 * and executes no actions. The result is deliberately bounded before it can
 * cross into the Intelligence Router.
 */
export function buildContext(input: ContextBuilderInput): ContextPacket {
  const maxItems = input.maxItems ?? DEFAULT_MAX_ITEMS
  const maxCharacters = input.maxCharacters ?? DEFAULT_MAX_CHARACTERS
  const query = input.userGoal ?? input.experience.content
  const excludedContext: string[] = []

  if (!input.surface?.world) excludedContext.push("surface.world unavailable")
  if (!input.surface?.route) excludedContext.push("surface.route unavailable")
  if (!input.surface?.project) excludedContext.push("surface.project unavailable")
  if (!input.patterns) excludedContext.push("patterns unavailable: PatternPort not implemented")
  if (!input.personality) excludedContext.push("personality unavailable: PersonalityPort not implemented")

  const rankedMemories = [...(input.memories ?? [])]
    .sort((a, b) => {
      const scoreDelta = relevance(query, b.content) - relevance(query, a.content)
      if (scoreDelta) return scoreDelta
      return String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")) || a.id.localeCompare(b.id)
    })

  const candidates = [
    ...rankedMemories.map(memoryEvidence),
    ...(input.observations ?? [])
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || a.id.localeCompare(b.id))
      .map(observationEvidence),
  ]

  const selected: EvidenceRef[] = []
  let characters = 0
  for (const item of candidates) {
    if (selected.length >= maxItems) {
      excludedContext.push("context item limit reached")
      break
    }
    const cost = item.summary.length
    if (characters + cost > maxCharacters) {
      excludedContext.push(`trimmed context item ${item.id} to respect character budget`)
      continue
    }
    selected.push(item)
    characters += cost
  }

  if ((input.memories ?? []).length > rankedMemories.length) {
    excludedContext.push("some memories were unavailable")
  }

  const constraints = (input.constraints ?? [
    "Model output is advisory and must pass deterministic policy before action.",
    "Context contains no execution authority or approval receipts.",
  ]).map(redactContextText)

  return {
    id: `ctx_${crypto.randomUUID()}`,
    purpose: redactContextText(input.purpose),
    userGoal: input.userGoal ? redactContextText(input.userGoal) : undefined,
    relevantMemories: selected,
    patterns: input.patterns ?? [],
    personality: input.personality ?? {
      version: 0,
      traits: [],
      independentAssessmentRequired: true,
      updatedAt: new Date(0).toISOString(),
    },
    knowledge: (input.knowledge ?? []).map((item) => ({
      ...item,
      summary: redactContextText(item.summary),
    })),
    constraints,
    excludedContext: [...new Set(excludedContext)],
  }
}
