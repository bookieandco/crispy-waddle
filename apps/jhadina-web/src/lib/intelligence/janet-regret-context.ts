import type {
  RegretMemory,
  RegretRecallResult,
  RegretRecord,
  RegretMemoryQuery,
} from "@jhadina/core-spine"
import type { DurableRegretMemory } from "../storage/SupabaseRegretMemory"

/**
 * JANET-facing adapter for Regret Memory.
 *
 * This intentionally returns context only. It cannot approve, execute,
 * mutate policy, or promote a regret into a fact.
 */
export interface JanetRegretContext {
  query: string
  regrets: readonly RegretRecallResult[]
}

export interface JanetRegretContextProvider {
  getRegretContext(params: {
    userId: string
    query: string
    subjectType?: RegretRecord["subjectType"]
    limit?: number
  }): JanetRegretContext | Promise<JanetRegretContext>
}

export class JanetRegretContextAdapter implements JanetRegretContextProvider {
  constructor(private readonly regretMemory: RegretMemory) {}

  getRegretContext(params: {
    userId: string
    query: string
    subjectType?: RegretRecord["subjectType"]
    limit?: number
  }): JanetRegretContext {
    if (!params.userId) throw new Error("userId is required")
    if (!params.query.trim()) return { query: params.query, regrets: [] }

    return {
      query: params.query,
      regrets: this.regretMemory.retrieve({
        userId: params.userId,
        text: params.query,
        subjectType: params.subjectType,
        limit: params.limit ?? 5,
      }),
    }
  }
}

/** Durable JANET adapter. Persistence remains behind the context boundary. */
export class JanetDurableRegretContextAdapter implements JanetRegretContextProvider {
  constructor(private readonly regretMemory: DurableRegretMemory) {}

  async getRegretContext(params: {
    userId: string
    query: string
    subjectType?: RegretRecord["subjectType"]
    limit?: number
  }): Promise<JanetRegretContext> {
    if (!params.userId) throw new Error("userId is required")
    if (!params.query.trim()) return { query: params.query, regrets: [] }

    const query: RegretMemoryQuery = {
      userId: params.userId,
      text: params.query,
      subjectType: params.subjectType,
      limit: params.limit ?? 5,
    }
    return {
      query: params.query,
      regrets: await this.regretMemory.retrieve(query),
    }
  }
}
