/**
 * Commerce sandbox-payment milestone: local idempotency guard,
 * mirroring money-core's already-proven IdempotencyStore shape
 * (claim/complete/waitForCompletion) rather than inventing a different
 * one. Implemented locally instead of imported from @jhadina/money-core
 * for the same layering reason as sandbox-credential.ts — commerce's
 * composition layer stays self-contained, matching SP-2's precedent of
 * never reaching into money-core.
 */

export type SandboxWriteResult = {
  providerReference: string
  status: string
}

type Record_ = {
  requestId: string
  status: "processing" | "completed"
  result?: SandboxWriteResult
}

export interface SandboxIdempotencyStore {
  claim(requestId: string): Promise<{ claimed: true } | { claimed: false }>
  complete(requestId: string, result: SandboxWriteResult): Promise<void>
  getResult(requestId: string): Promise<SandboxWriteResult | undefined>
}

export function createInMemorySandboxIdempotencyStore(): SandboxIdempotencyStore {
  const records = new Map<string, Record_>()

  return {
    async claim(requestId) {
      if (records.has(requestId)) return { claimed: false }
      records.set(requestId, { requestId, status: "processing" })
      return { claimed: true }
    },
    async complete(requestId, result) {
      const existing = records.get(requestId)
      if (!existing) throw new Error("SANDBOX_IDEMPOTENCY_NOT_CLAIMED")
      records.set(requestId, { ...existing, status: "completed", result })
    },
    async getResult(requestId) {
      return records.get(requestId)?.result
    },
  }
}
