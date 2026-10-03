import { describe, expect, it } from "vitest"
import { emptyPersonalityState } from "@jhadina/core-spine"
import { SupabasePersonalityStateRepository } from "./supabase-personality-state-repository"

function fakeClient(row: { state: unknown; version: number } | null = null) {
  const rpcCalls: unknown[] = []
  return {
    rpc: async (_name: string, args: unknown) => {
      rpcCalls.push(args)
      return { error: null }
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({
              maybeSingle: async () => ({ data: row, error: null }),
            }),
          }),
        }),
      }),
    }),
    rpcCalls,
  }
}

describe("SupabasePersonalityStateRepository", () => {
  it("returns the canonical empty state when no durable state exists", async () => {
    const repository = new SupabasePersonalityStateRepository(fakeClient() as never)
    await expect(repository.load()).resolves.toEqual(
      emptyPersonalityState(new Date(0).toISOString()),
    )
  })

  it("rejects a persisted state whose row version disagrees with its state version", async () => {
    const state = emptyPersonalityState("2026-09-02T00:00:00.000Z")
    const repository = new SupabasePersonalityStateRepository(
      fakeClient({ state, version: 9 }) as never,
    )
    await expect(repository.load()).rejects.toThrow("version does not match")
  })

  it("rejects malformed nested personality state instead of casting through it", async () => {
    const state = emptyPersonalityState("2026-09-02T00:00:00.000Z")
    const invalid = {
      ...state,
      voice: { ...state.voice!, directness: 2 },
    }
    const repository = new SupabasePersonalityStateRepository(
      fakeClient({ state: invalid, version: 0 }) as never,
    )
    await expect(repository.load()).rejects.toThrow("voice.directness")
  })

  it("rejects malformed trait evidence and semantic IDs", async () => {
    const state = emptyPersonalityState("2026-09-02T00:00:00.000Z")
    const invalid = {
      ...state,
      traits: [{
        id: "trait-1",
        statement: "prefers direct communication",
        sourcePatternId: "",
        dimension: "communication",
        confidence: 0.9,
        stability: 1,
        evidence: [{ id: "", source: "memory", summary: "x", observedAt: "not-a-date" }],
        contradictions: [],
        status: "accepted",
      }],
    }
    const repository = new SupabasePersonalityStateRepository(
      fakeClient({ state: invalid, version: 0 }) as never,
    )
    await expect(repository.load()).rejects.toThrow("sourcePatternId")
  })

  it("writes through the atomic RPC with the expected version", async () => {
    const state = emptyPersonalityState("2026-09-02T00:00:00.000Z")
    const client = fakeClient({ state, version: 0 })
    const repository = new SupabasePersonalityStateRepository(client as never)
    const next = { ...state, version: 1, updatedAt: "2026-09-02T00:01:00.000Z" }

    await repository.save(0, next)

    expect(client.rpcCalls).toEqual([
      {
        p_profile_id: "default",
        p_expected_version: 0,
        p_next_state: next,
      },
    ])
  })

  it("accepts callback-specific provenance and rejects malformed callback evidence", async () => {
    const state = emptyPersonalityState("2026-10-03T19:00:00.000Z")
    const valid = {
      ...state,
      relationship: {
        ...state.relationship!,
        recurringCallbacks: ["red chair"],
        callbackEvidence: [{
          callback: "red chair",
          evidence: [{
            id: "reason-red-chair-1",
            source: "memory",
            summary: "red chair joke came back",
            observedAt: "2026-10-03T18:00:00.000Z",
            immutable: true,
          }],
        }],
      },
    }
    const repository = new SupabasePersonalityStateRepository(
      fakeClient({ state: valid, version: valid.version }) as never,
    )
    await expect(repository.load()).resolves.toMatchObject({
      relationship: {
        recurringCallbacks: ["red chair"],
        callbackEvidence: [expect.objectContaining({ callback: "red chair" })],
      },
    })

    const invalid = {
      ...valid,
      relationship: {
        ...valid.relationship,
        callbackEvidence: [{ callback: "", evidence: [] }],
      },
    }
    const invalidRepository = new SupabasePersonalityStateRepository(
      fakeClient({ state: invalid, version: invalid.version }) as never,
    )
    await expect(invalidRepository.load()).rejects.toThrow("callbackEvidence[0].callback")
  })

})
