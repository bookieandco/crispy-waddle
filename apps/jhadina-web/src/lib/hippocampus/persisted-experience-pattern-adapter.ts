import {
  createHippocampusIndex,
  createPatternPort,
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

export interface PersistedExperiencePatternInput {
  userId: string
  experienceId: string
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
      id: memory.id,
      source: "memory",
      observedAt,
      summary: memory.content,
      immutable: true,
    }],
    disposition: "SAVE",
  }
}

function relevantMemoryProposals(
  memories: readonly Memory[],
  relatedEpisodes: readonly HippocampalEpisode[],
): MemoryProposal[] {
  const relatedTerms = new Set(
    relatedEpisodes.flatMap((episode) => episode.indexedTerms),
  )

  return memories
    .filter((memory) => memory.status === "APPROVED")
    .filter((memory) => tokenize(memory.content).some((term) => relatedTerms.has(term)))
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
  constructor(
    private readonly storage: MemoryStorage,
    private readonly patternPort: PatternPort = createPatternPort(),
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

    const experience = reasoningEventToExperience(persisted)
    const history = await this.storage.listReasoningEvents(
      input.userId,
      input.historyLimit ?? 50,
    )
    const hippocampus = createHippocampusIndex()
    const episodes = history.map((event) => hippocampus.encode(reasoningEventToExperience(event)))
    const relatedEpisodes = hippocampus.related(
      episodes,
      input.query?.trim() || experience.content,
    )

    const durableMemories = await this.storage.listMemories(input.userId)
    const memories = relevantMemoryProposals(durableMemories, relatedEpisodes)
    const patterns = await this.patternPort.detect(experience, memories)

    return {
      experience,
      relatedEpisodes,
      memories,
      patterns,
    }
  }
}
