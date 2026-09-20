import {
  createCanonicalPatternPort,
  createHippocampusIndex,
  type Experience,
  type HippocampalEpisode,
  type MemoryProposal,
  type PatternObservation,
  type PatternPort,
} from "@jhadina/core-spine"
import type {
  Memory,
  ReasoningEvent,
} from "../storage/InMemoryStorage"
import type { MemoryStorage } from "../storage/MemoryStorage"
import { HippocampalEpisodePatternAdapter } from "./hippocampal-episode-pattern-adapter"

export interface PersistedExperiencePatternInput {
  userId: string
  experienceId: string
  query?: string
  historyLimit?: number
}

export interface LiveExperiencePatternInput {
  userId: string
  experience: Experience
  query?: string
  historyLimit?: number
}

export interface PersistedExperiencePatternResult {
  experience: Experience
  relatedEpisodes: HippocampalEpisode[]
  memories: MemoryProposal[]
  patterns: PatternObservation[]
}

function tokenize(value: string): string[] {
  return [...new Set(value.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) ?? [])]
}

function reasoningEventToExperience(event: ReasoningEvent): Experience {
  const evidenceSummary = event.observation.extracted.trim() || event.userMessage.trim()

  return {
    id: event.id,
    occurredAt: event.timestamp,
    source: "conversation",
    domain: event.classification.type.toLowerCase(),
    actor: "user",
    provenance: {
      persistence: "jhadina_reasoning_events",
      reasoningEventId: event.id,
      userId: event.userId,
    },
    content: event.userMessage,
    evidence: [{
      id: event.id,
      source: "reasoning-event",
      observedAt: event.timestamp,
      summary: evidenceSummary,
      immutable: true,
    }],
    metadata: {
      reasoningConfidence: event.confidence,
      classification: {
        type: event.classification.type,
        confidence: event.classification.confidence,
      },
      candidateId: event.candidateId,
    },
  }
}

function approvedMemoryToProposal(memory: Memory): MemoryProposal {
  const observedAt = memory.approvedAt ?? memory.createdAt

  return {
    id: memory.id,
    content: memory.content,
    reason: "approved durable Jhadina memory",
    evidence: [{
      id: memory.reasoningEventId ?? memory.id,
      source: "memory",
      observedAt,
      summary: memory.content,
      immutable: true,
    }],
    disposition: "SAVE",
  }
}

const MAX_RELEVANT_MEMORIES = 100
const MAX_PATTERN_HYPOTHESES = 64

function relevantMemoryProposals(
  memories: readonly Memory[],
  currentEpisode: HippocampalEpisode,
  relatedEpisodes: readonly HippocampalEpisode[],
): MemoryProposal[] {
  const relatedTerms = new Set([
    ...currentEpisode.indexedTerms,
    ...relatedEpisodes.flatMap((episode) => episode.indexedTerms),
  ])

  return memories
    .filter((memory) => memory.status === "APPROVED")
    .filter((memory) => tokenize(memory.content).some((term) => relatedTerms.has(term)))
    .slice(0, MAX_RELEVANT_MEMORIES)
    .map(approvedMemoryToProposal)
}

/**
 * Adapter from Jhadina's existing durable reasoning-event/memory storage into
 * the Core Spine learning path.
 *
 * This deliberately does not create another episodic database. Production
 * persistence remains owned by MemoryStorage/SupabaseMemoryStorage:
 *
 * jhadina_reasoning_events
 *   -> Experience
 *   -> Hippocampus retrieval
 * jhadina_memories (APPROVED only)
 *   -> MemoryProposal evidence
 *   -> PatternPort
 */
export class PersistedExperiencePatternAdapter {
  private readonly episodicPatterns = new HippocampalEpisodePatternAdapter()

  constructor(
    private readonly storage: MemoryStorage,
    private readonly patternPort: PatternPort = createCanonicalPatternPort(),
  ) {}

  async detect(
    input: PersistedExperiencePatternInput,
  ): Promise<PersistedExperiencePatternResult> {
    const persisted = await this.storage.getReasoningEvent(input.experienceId)
    if (!persisted) {
      throw new Error(`JHADINA_EXPERIENCE_NOT_FOUND:${input.experienceId}`)
    }
    if (persisted.userId !== input.userId) {
      throw new Error(`JHADINA_EXPERIENCE_USER_MISMATCH:${input.experienceId}`)
    }

    return this.detectExperience({
      userId: input.userId,
      experience: reasoningEventToExperience(persisted),
      query: input.query,
      historyLimit: input.historyLimit,
    })
  }

  /**
   * Analyze the current request before it is persisted. Only historical
   * episodes and approved memories are read from durable storage; the live
   * Experience is supplied by the caller and is never silently persisted here.
   */
  async detectExperience(
    input: LiveExperiencePatternInput,
  ): Promise<PersistedExperiencePatternResult> {
    const history = await this.storage.listReasoningEvents(
      input.userId,
      input.historyLimit ?? 50,
    )
    const hippocampus = createHippocampusIndex()
    const currentEpisode = hippocampus.encode(input.experience)
    const historicalEpisodes = history.map((event) =>
      hippocampus.encode(reasoningEventToExperience(event)),
    )
    const relatedEpisodes = hippocampus.related(
      historicalEpisodes,
      input.query?.trim() || input.experience.content,
    )

    const durableMemories = await this.storage.listMemories(input.userId)
    const memories = relevantMemoryProposals(
      durableMemories,
      currentEpisode,
      relatedEpisodes,
    )
    const memoryBackedPatterns = await this.patternPort.detect(input.experience, memories)
    const coveredEvidenceByTerm = new Map<string, Set<string>>()
    for (const pattern of memoryBackedPatterns) {
      if (!pattern.id.startsWith("recurrence:")) continue
      const term = pattern.id.slice("recurrence:".length)
      const ids = new Set(
        [...pattern.evidence, ...pattern.contradictions]
          .map((ref) => ref.id)
          .filter((id) => id !== input.experience.id),
      )
      if (ids.size > 0) coveredEvidenceByTerm.set(term, ids)
    }
    const episodeBackedPatterns = this.episodicPatterns.detect(
      input.experience,
      relatedEpisodes,
      coveredEvidenceByTerm,
    )
    const patternPriority = (pattern: PatternObservation): number =>
      pattern.id.startsWith("personality-signal:") ? 0
        : pattern.id.startsWith("relationship-context:") ? 1
          : 2
    const patterns = [...memoryBackedPatterns, ...episodeBackedPatterns]
      .sort(
        (left, right) =>
          patternPriority(left) - patternPriority(right) ||
          left.id.localeCompare(right.id),
      )
      .slice(0, MAX_PATTERN_HYPOTHESES)

    return {
      experience: input.experience,
      relatedEpisodes,
      memories,
      patterns,
    }
  }
}
