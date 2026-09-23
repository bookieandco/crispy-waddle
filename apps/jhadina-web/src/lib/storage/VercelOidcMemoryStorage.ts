import type { MemoryStorage } from "./MemoryStorage"
import type {
  Memory,
  MemoryCandidate,
  ReasoningEvent,
  TimelineEvent,
} from "./InMemoryStorage"

const DEFAULT_GATEWAY_URL =
  "https://kqbkaozfjubkjevdfvic.supabase.co/functions/v1/jhadina-memory-gateway"

type GatewayOptions = {
  endpoint?: string
  tokenProvider?: () => string | undefined
  fetchImpl?: typeof fetch
}

export class VercelOidcMemoryStorage implements MemoryStorage {
  private readonly endpoint: string
  private readonly tokenProvider: () => string | undefined
  private readonly fetchImpl: typeof fetch

  constructor(options: GatewayOptions = {}) {
    this.endpoint =
      options.endpoint ??
      process.env.JHADINA_MEMORY_GATEWAY_URL?.trim() ??
      DEFAULT_GATEWAY_URL
    this.tokenProvider =
      options.tokenProvider ??
      (() => process.env.VERCEL_OIDC_TOKEN?.trim())
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  private async call<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
    const token = this.tokenProvider()
    if (!token) {
      throw new Error("JHADINA_MEMORY_VERCEL_OIDC_REQUIRED")
    }

    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ action, payload }),
      cache: "no-store",
    })

    let body: { data?: T; error?: string }
    try {
      body = (await response.json()) as { data?: T; error?: string }
    } catch {
      throw new Error(`JHADINA_MEMORY_GATEWAY_FAILED:${action}:invalid_json`)
    }

    if (!response.ok) {
      throw new Error(
        `JHADINA_MEMORY_GATEWAY_FAILED:${action}:${response.status}:${body.error ?? "unknown"}`,
      )
    }

    return body.data as T
  }

  async probe(): Promise<void> {
    await this.call<{ ok: true }>("probe")
  }

  async createMemory(data: Omit<Memory, "id">): Promise<Memory> {
    return this.call<Memory>("createMemory", { data })
  }

  async getMemory(id: string): Promise<Memory | undefined> {
    return (await this.call<Memory | null>("getMemory", { id })) ?? undefined
  }

  async listMemories(userId: string): Promise<Memory[]> {
    return this.call<Memory[]>("listMemories", { userId })
  }

  async retireMemory(
    id: string,
    userId: string,
    reason: "corrected" | "forgotten" | "retired",
    revokedAt: string,
  ): Promise<Memory | undefined> {
    return (await this.call<Memory | null>("retireMemory", {
      id,
      userId,
      reason,
      revokedAt,
    })) ?? undefined
  }

  async correctMemory(params: {
    memoryId: string
    userId: string
    content: string
    confidence: number
    reasoningEventId: string
    correctedAt: string
  }): Promise<{ retired: Memory; replacement: Memory }> {
    return this.call("correctMemory", { params })
  }

  async createCandidate(data: Omit<MemoryCandidate, "id">): Promise<MemoryCandidate> {
    return this.call<MemoryCandidate>("createCandidate", { data })
  }

  async getCandidate(id: string): Promise<MemoryCandidate | undefined> {
    return (await this.call<MemoryCandidate | null>("getCandidate", { id })) ?? undefined
  }

  async listCandidates(userId: string, status?: "PENDING"): Promise<MemoryCandidate[]> {
    return this.call<MemoryCandidate[]>("listCandidates", { userId, status })
  }

  async removeCandidate(id: string): Promise<void> {
    await this.call<null>("removeCandidate", { id })
  }

  async createReasoningEvent(
    data: Omit<ReasoningEvent, "id"> & { id?: string },
  ): Promise<ReasoningEvent> {
    return this.call<ReasoningEvent>("createReasoningEvent", { data })
  }

  async getReasoningEvent(id: string): Promise<ReasoningEvent | undefined> {
    return (await this.call<ReasoningEvent | null>("getReasoningEvent", { id })) ?? undefined
  }

  async updateReasoningEvent(
    id: string,
    userId: string,
    updates: Partial<ReasoningEvent>,
  ): Promise<ReasoningEvent | undefined> {
    return (
      (await this.call<ReasoningEvent | null>("updateReasoningEvent", {
        id,
        userId,
        updates,
      })) ?? undefined
    )
  }

  async listReasoningEvents(userId: string, limit: number = 50): Promise<ReasoningEvent[]> {
    return this.call<ReasoningEvent[]>("listReasoningEvents", { userId, limit })
  }

  async appendTimelineEvent(data: Omit<TimelineEvent, "id">): Promise<TimelineEvent> {
    return this.call<TimelineEvent>("appendTimelineEvent", { data })
  }

  async listTimeline(userId: string, limit: number = 50): Promise<TimelineEvent[]> {
    return this.call<TimelineEvent[]>("listTimeline", { userId, limit })
  }
}
