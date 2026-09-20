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
})
