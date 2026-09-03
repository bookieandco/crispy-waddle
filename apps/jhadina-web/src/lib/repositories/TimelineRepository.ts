/**
 * TimelineRepository
 *
 * Manages the chronological record of system activity.
 * User identity is always explicit; there is no demo/default identity.
 */

import { TimelineEvent, MemoryType } from "../storage/InMemoryStorage"
import type { MemoryStorage } from "../storage/MemoryStorage"

export class TimelineRepository {
  constructor(private storage: MemoryStorage) {}

  async recordReasoning(params: {
    userId: string
    reasoningEventId: string
    userMessage: string
    systemResponse: string
  }): Promise<TimelineEvent> {
    return this.storage.appendTimelineEvent({
      userId: params.userId,
      timestamp: new Date().toISOString(),
      type: "REASONING",
      reasoningEventId: params.reasoningEventId,
    })
  }

  async recordApproval(params: {
    userId: string
    memoryId: string
    memoryType: MemoryType
    memoryContent: string
  }): Promise<TimelineEvent> {
    return this.storage.appendTimelineEvent({
      userId: params.userId,
      timestamp: new Date().toISOString(),
      type: "APPROVAL",
      memoryId: params.memoryId,
      memoryType: params.memoryType,
      memoryContent: params.memoryContent,
      decision: "APPROVED",
    })
  }

  async recordRejection(params: {
    userId: string
    memoryId: string
    memoryType: MemoryType
    memoryContent: string
  }): Promise<TimelineEvent> {
    return this.storage.appendTimelineEvent({
      userId: params.userId,
      timestamp: new Date().toISOString(),
      type: "REJECTION",
      memoryId: params.memoryId,
      memoryType: params.memoryType,
      memoryContent: params.memoryContent,
      decision: "REJECTED",
    })
  }

  async list(userId: string, limit: number = 50, offset: number = 0): Promise<TimelineEvent[]> {
    const events = await this.storage.listTimeline(userId, limit + offset)
    return events.slice(offset, offset + limit)
  }

  async count(userId: string): Promise<number> {
    const events = await this.storage.listTimeline(userId, 10000)
    return events.length
  }

  async dump(userId: string): Promise<string> {
    if (!userId) throw new Error("userId is required")
    const lines = ["TimelineRepository", "─".repeat(40)]
    const events = await this.storage.listTimeline(userId, 10)
    lines.push(`Total Events: ${events.length}`)

    if (events.length > 0) {
      lines.push("Recent Events:")
      for (const event of events.slice(0, 10)) {
        const time = event.timestamp.slice(11, 19)
        let desc = event.type
        if (event.type === "APPROVAL") desc = `APPROVAL | ${event.memoryType}`
        else if (event.type === "REJECTION") desc = `REJECTION | ${event.memoryType}`
        lines.push(`  ${time} | ${desc}`)
      }
    }

    return lines.join("\n")
  }
}
