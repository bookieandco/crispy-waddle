/**
 * TimelineRepository
 *
 * Manages timeline events - chronological record of system activity.
 * Records: reasoning events, approvals, rejections, pattern promotions, decision reviews.
 *
 * Works against InMemoryStorage.
 */

import {
  TimelineEvent,
  InMemoryStorage,
  MemoryType,
} from "../storage/InMemoryStorage"

export class TimelineRepository {
  constructor(private storage: InMemoryStorage) {}

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
    const events = this.storage.listTimeline(userId, limit + offset)
    return events.slice(offset, offset + limit)
  }

  async count(userId: string): Promise<number> {
    return this.storage.listTimeline(userId, 10000).length
  }

  dump(userId?: string): string {
    const lines: string[] = []
    lines.push("TimelineRepository")
    lines.push("─".repeat(40))

    const events = this.storage.listTimeline(userId || "user_demo", 10)
    lines.push(`Total Events: ${events.length}`)

    if (events.length > 0) {
      lines.push("Recent Events:")
      for (const event of events.slice(0, 10)) {
        const time = event.timestamp.slice(11, 19)
        let desc: string = event.type
        if (event.type === "APPROVAL") {
          desc = `APPROVAL | ${event.memoryType ?? "UNKNOWN"}`
        } else if (event.type === "REJECTION") {
          desc = `REJECTION | ${event.memoryType ?? "UNKNOWN"}`
        } else if (event.type === "REASONING") {
          desc = "REASONING"
        }
        lines.push(`  ${time} | ${desc}`)
      }
    }

    return lines.join("\n")
  }
}
