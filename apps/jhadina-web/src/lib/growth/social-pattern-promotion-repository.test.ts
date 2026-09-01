import { describe, expect, it } from "vitest"
import { SupabaseSocialPatternPromotionStore } from "./social-pattern-promotion-repository"

function createFakeClient() {
  const rows: Record<string, unknown>[] = []
  return {
    rows,
    from() {
      return {
        upsert(value: Record<string, unknown>) {
          const index = rows.findIndex((row) => row.id === value.id)
          if (index >= 0) rows[index] = { ...rows[index], ...value }
          else rows.push({ ...value })
          return Promise.resolve({ error: null })
        },
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

describe("SupabaseSocialPatternPromotionStore", () => {
  it("round-trips promotion provenance and scopes account reads", async () => {
    const client = createFakeClient()
    const store = new SupabaseSocialPatternPromotionStore(client)
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

    await store.upsert(record)

    await expect(store.getById(record.id)).resolves.toEqual(record)
    await expect(store.listForAccount(record.targetAccountId)).resolves.toEqual([record])
    await expect(store.listForAccount("account:c" as never)).resolves.toEqual([])
  })

  it("upserts by stable promotion id without changing provenance fields", async () => {
    const client = createFakeClient()
    const store = new SupabaseSocialPatternPromotionStore(client)
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

    await store.upsert(record)
    await store.upsert({ ...record, confidence: 0.9 })

    const loaded = await store.getById(record.id)
    expect(loaded?.confidence).toBe(0.9)
    expect(loaded?.sourcePatternId).toBe("pattern:original")
    expect(loaded?.sourceAccountId).toBe("account:a")
  })
})
