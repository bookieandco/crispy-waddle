import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const maybeSingle = vi.fn()
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  const userFrom = vi.fn(() => ({ select }))
  const createClient = vi.fn(async () => ({ from: userFrom }))

  const trustedRpc = vi.fn()
  const createServiceRoleClient = vi.fn(
    (): { rpc: typeof trustedRpc } | null => ({ rpc: trustedRpc }),
  )

  return {
    maybeSingle,
    eq,
    userFrom,
    createClient,
    trustedRpc,
    createServiceRoleClient,
  }
})

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }))
vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: mocks.createServiceRoleClient,
}))

import { createSupabaseSamPursuitSnapshotRepository } from "./supabase-sam-pursuit-snapshot-repository"

describe("Supabase SAM pursuit snapshot repository", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("loads the current authenticated-user snapshot through RLS", async () => {
    mocks.maybeSingle.mockResolvedValueOnce({
      data: {
        snapshot: { opportunityId: "sam:1", schemaVersion: 1, revision: 1, savedAt: "2026-09-20T00:00:00Z" },
        checksum: "fnv1a32:abc",
      },
      error: null,
    })
    const repo = createSupabaseSamPursuitSnapshotRepository("user-1")
    const loaded = await repo.load("sam:1")
    expect(mocks.userFrom).toHaveBeenCalledWith("jhadina_sam_pursuit_snapshots")
    expect(mocks.eq).toHaveBeenCalledWith("opportunity_id", "sam:1")
    expect(loaded?.checksum).toBe("fnv1a32:abc")
  })

  it("saves only through the trusted RPC bound to verified identity", async () => {
    mocks.trustedRpc.mockResolvedValueOnce({ data: { ok: true }, error: null })
    const repo = createSupabaseSamPursuitSnapshotRepository("user-1")
    const envelope = {
      snapshot: {
        schemaVersion: 1 as const,
        opportunityId: "sam:1",
        revision: 2,
        savedAt: "2026-09-20T00:00:00Z",
        requirements: { opportunityId: "sam:1", requirements: [], unresolved: [], generatedAt: "2026-09-20T00:00:00Z" },
        freshness: [],
        ledgers: [],
        negotiations: [],
        contractReadiness: [],
        contractDrafts: [],
        pursuit: { opportunityId: "sam:1", status: "in_progress" as const, stages: [], blockers: [], humanGatesRemaining: [], executionAuthorized: false as const },
      },
      checksum: "fnv1a32:def",
    }
    await repo.save(envelope, 1)
    expect(mocks.createServiceRoleClient).toHaveBeenCalled()
    expect(mocks.trustedRpc).toHaveBeenCalledWith("jhadina_sam_pursuit_snapshot_save_trusted", {
      p_user_id: "user-1",
      p_envelope: envelope,
      p_expected_revision: 1,
    })
  })

  it("fails closed when trusted persistence is unavailable", async () => {
    mocks.createServiceRoleClient.mockReturnValueOnce(null)
    const repo = createSupabaseSamPursuitSnapshotRepository("user-1")
    await expect(repo.save({} as never, null)).rejects.toThrow(/service role is not configured/)
  })
})
