/**
 * ReasoningEventRepository
 *
 * Manages reasoning events — the durable audit trail of every decision.
 * User identity is always explicit; there is no demo/default identity.
 */

import {
  ReasoningEvent,
  Observation,
  Classification,
} from "../storage/InMemoryStorage"
import type { MemoryStorage } from "../storage/MemoryStorage"

export class ReasoningEventRepository {
  constructor(private storage: MemoryStorage) {}

  async create(params: {
    userId: string
    userMessage: string
    observation: Observation
    classification: Classification
    systemResponse: string
    confidence: number
    candidateId?: string
  }): Promise<ReasoningEvent> {
    return this.storage.createReasoningEvent({
      userId: params.userId,
      timestamp: new Date().toISOString(),
      userMessage: params.userMessage,
      observation: params.observation,
      classification: params.classification,
      systemResponse: params.systemResponse,
      confidence: params.confidence,
      candidateId: params.candidateId,
    })
  }

  async get(eventId: string): Promise<ReasoningEvent | null> {
    const event = await this.storage.getReasoningEvent(eventId)
    return event || null
  }

  async list(userId: string, limit: number = 50, offset: number = 0): Promise<ReasoningEvent[]> {
    const events = await this.storage.listReasoningEvents(userId, limit + offset)
    return events.slice(offset, offset + limit)
  }

  async getMostRecent(userId: string): Promise<ReasoningEvent | null> {
    const events = await this.storage.listReasoningEvents(userId, 1)
    return events.length > 0 ? events[0] : null
  }

  async count(userId: string): Promise<number> {
    const events = await this.storage.listReasoningEvents(userId, 10000)
    return events.length
  }

  async dump(userId: string): Promise<string> {
    if (!userId) throw new Error("userId is required")
    const lines = ["ReasoningEventRepository", "─".repeat(40)]
    const events = await this.storage.listReasoningEvents(userId, 10)
    lines.push(`Total Events: ${events.length}`)

    if (events.length > 0) {
      lines.push("Recent Events:")
      for (const event of events.slice(0, 5)) {
        const time = event.timestamp.slice(11, 19)
        lines.push(
          `  ${time} | Message: "${event.userMessage.slice(0, 30)}..." | Confidence: ${event.confidence.toFixed(2)}`,
        )
      }
    }

    return lines.join("\n")
  }
}
