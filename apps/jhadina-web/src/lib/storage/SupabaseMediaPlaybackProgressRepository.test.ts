import { describe, expect, it, vi } from "vitest"
import {
  InMemoryMediaPlaybackProgressRepository,
  type MediaPlaybackProgress,
} from "@jhadina/tv-core"
import { SupabaseMediaPlaybackProgressRepository } from "./SupabaseMediaPlaybackProgressRepository"

const progress = (overrides: Partial<MediaPlaybackProgress> = {}): MediaPlaybackProgress => ({
  userId: "user-1",
  providerId: "youtube",
  itemId: "video-1",
  positionMs: 30_000,
  durationMs: 120_000,
  completed: false,
  updatedAt: "2026-09-01T13:00:00.000Z",
  ...overrides,
})

describe("InMemoryMediaPlaybackProgressRepository", () => {
  it("inserts and reads progress", async () => {
    const repository = new InMemoryMediaPlaybackProgressRepository()
    const saved = await repository.upsert(progress())

    expect(saved).toEqual(progress())
    expect(await repository.get("user-1", "youtube", "video-1")).toEqual(progress())
  })

  it("accepts a newer timestamp", async () => {
    const repository = new InMemoryMediaPlaybackProgressRepository()
    await repository.upsert(progress({ positionMs: 30_000 }))

    const saved = await repository.upsert(
      progress({ positionMs: 60_000, updatedAt: "2026-09-01T13:01:00.000Z" }),
    )

    expect(saved.positionMs).toBe(60_000)
    expect(saved.updatedAt).toBe("2026-09-01T13:01:00.000Z")
  })

  it("rejects an older delayed write", async () => {
    const repository = new InMemoryMediaPlaybackProgressRepository()
    await repository.upsert(
      progress({ positionMs: 60_000, updatedAt: "2026-09-01T13:01:00.000Z" }),
    )

    const saved = await repository.upsert(
      progress({ positionMs: 30_000, updatedAt: "2026-09-01T13:00:00.000Z" }),
    )

    expect(saved.positionMs).toBe(60_000)
    expect(saved.updatedAt).toBe("2026-09-01T13:01:00.000Z")
  })

  it("uses first-write-wins for equal timestamps", async () => {
    const repository = new InMemoryMediaPlaybackProgressRepository()
    await repository.upsert(progress({ positionMs: 30_000 }))

    const saved = await repository.upsert(progress({ positionMs: 90_000 }))

    expect(saved.positionMs).toBe(30_000)
  })

  it("isolates users, providers, and media ids", async () => {
    const repository = new InMemoryMediaPlaybackProgressRepository()
    await repository.upsert(progress({ positionMs: 30_000 }))

    await repository.upsert(progress({ userId: "user-2", positionMs: 40_000 }))
    await repository.upsert(progress({ providerId: "direct", positionMs: 50_000 }))
    await repository.upsert(progress({ itemId: "video-2", positionMs: 60_000 }))

    expect((await repository.get("user-1", "youtube", "video-1"))?.positionMs).toBe(30_000)
    expect((await repository.get("user-2", "youtube", "video-1"))?.positionMs).toBe(40_000)
    expect((await repository.get("user-1", "direct", "video-1"))?.positionMs).toBe(50_000)
    expect((await repository.get("user-1", "youtube", "video-2"))?.positionMs).toBe(60_000)
  })

  it("accepts a newer completion event", async () => {
    const repository = new InMemoryMediaPlaybackProgressRepository()
    await repository.upsert(progress())

    const saved = await repository.upsert(
      progress({ completed: true, positionMs: 120_000, updatedAt: "2026-09-01T13:02:00.000Z" }),
    )

    expect(saved.completed).toBe(true)
    expect(saved.positionMs).toBe(120_000)
  })
})

describe("SupabaseMediaPlaybackProgressRepository", () => {
  it("uses the atomic database RPC and returns the database winner", async () => {
    const rpcResult = progress({
      positionMs: 60_000,
      updatedAt: "2026-09-01T13:01:00.000Z",
    })
    const rpc = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: rpcResult, error: null }),
    })
    const client = { rpc } as never
    const repository = new SupabaseMediaPlaybackProgressRepository(client)

    const result = await repository.upsert(
      progress({ positionMs: 30_000, updatedAt: "2026-09-01T13:00:00.000Z" }),
    )

    expect(result).toEqual(rpcResult)
    expect(rpc).toHaveBeenCalledWith(
      "upsert_media_playback_progress",
      expect.objectContaining({
        p_user_id: "user-1",
        p_provider_id: "youtube",
        p_media_id: "video-1",
        p_position_ms: 30_000,
        p_updated_at: "2026-09-01T13:00:00.000Z",
      }),
    )
  })
})
