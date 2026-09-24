import { describe, expect, it } from "vitest"
import { SupabaseSocialPatternPromotionStore } from "./social-pattern-promotion-repository"

function createFakeClient() {
  const rows: Record<string, unknown>[] = []
  return {
    rows,
    rpc(fn: string, args: Record<string, unknown>) {
      if (fn === "upsert_social_pattern_promotion") {
        const value = args.payload as Record<string, unknown>
        const index = rows.findIndex((row) => row.id === value.id)
        if (index >= 0) {
          const current = rows[index]
          if (current.status === "revoked") return Promise.resolve({ data: null, error: null })
          if (["hypothesis_id", "source_pattern_id", "source_account_id", "target_account_id", "target_audience_id", "target_voice_id", "strategy", "experiment_id"].some((key) => current[key] !== value[key])) {
            return Promise.resolve({ data: null, error: { message: "promotion provenance is immutable" } })
          }
          rows[index] = {
            ...current,
            confidence: Math.max(Number(current.confidence), Number(value.confidence)),
            promoted_at: new Date(Math.min(Date.parse(String(current.promoted_at)), Date.parse(String(value.promoted_at)))).toISOString(),
          }
        } else rows.push({ ...value })
        return Promise.resolve({ data: null, error: null })
      }
      if (fn === "revoke_social_pattern_promotion") {
        const id = String(args.promotion_id)
        const row = rows.find((candidate) => candidate.id === id)
        if (!row) return Promise.resolve({ data: null, error: { message: "promotion not found" } })
        row.status = "revoked"
        row.revoked_at = args.revoked_at
        row.revocation_reason = args.reason
        return Promise.resolve({ data: null, error: null })
      }
      return Promise.resolve({ data: null, error: { message: `unexpected rpc ${fn}` } })
    },
    from() {
      return {
        select() {
          return {
            eq(column: string, value: string) {
              const matching = rows.filter((row) => row[column] === value)
              return {
                order() {
                  return Promise.resolve({ data: [...matching].reverse(), error: null })
                },
                maybeSingle() {
                  return Promise.resolve({ data: matching[0] ?? null, error: null })
                },
              }
            },
          }
        },
      }
    },
  }
}

const record = {
  id: "promoted:1" as never,
  hypothesisId: "hypothesis:1" as never,
  sourcePatternId: "pattern:original" as never,
  sourceAccountId: "account:a" as never,
  targetAccountId: "account:b" as never,
  targetAudienceId: "audience:b" as never,
  targetVoiceId: "voice:b" as never,
  strategy: "playful_challenge",
  confidence: 0.8,
  status: "promoted" as const,
  source: "validated_experiment" as const,
  experimentId: "experiment:1" as never,
  promotedAt: "2026-09-01T00:00:00Z",
}

describe("SupabaseSocialPatternPromotionStore", () => {
  it("round-trips promotion provenance and scopes account reads", async () => {
    const store = new SupabaseSocialPatternPromotionStore(createFakeClient())
    await store.upsert(record)
    await expect(store.getById(record.id)).resolves.toMatchObject(record)
    await expect(store.listForAccount(record.targetAccountId)).resolves.toHaveLength(1)
    await expect(store.listForAccount("account:c" as never)).resolves.toEqual([])
  })

  it("never lets a stale write lower confidence or rewrite provenance", async () => {
    const client = createFakeClient()
    const store = new SupabaseSocialPatternPromotionStore(client)
    await store.upsert(record)
    await store.upsert({ ...record, confidence: 0.9 })
    await expect(store.getById(record.id)).resolves.toMatchObject({ confidence: 0.9, sourcePatternId: record.sourcePatternId })
    await expect(store.upsert({ ...record, confidence: 0.1, sourceAccountId: "account:evil" as never })).rejects.toThrow("promotion provenance is immutable")
    await expect(store.getById(record.id)).resolves.toMatchObject({ confidence: 0.9, sourceAccountId: record.sourceAccountId })
  })

  it("makes revocation terminal", async () => {
    const client = createFakeClient()
    const store = new SupabaseSocialPatternPromotionStore(client)
    await store.upsert(record)
    await store.revoke(record.id, "2026-09-01T01:00:00Z", "experiment_invalidated")
    const revoked = await store.getById(record.id)
    expect(revoked?.status).toBe("revoked")
    await store.upsert({ ...record, confidence: 1 })
    await expect(store.getById(record.id)).resolves.toMatchObject({ status: "revoked", confidence: 0.8 })
  })
})
