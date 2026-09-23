import { describe, expect, it, vi } from "vitest"
import type { JhadinaWorkSession, WorkSessionRepository } from "@jhadina/core-spine"
import { resolveWorkSessionArtifactContext } from "./work-session-artifact-resume"

function session(ownerUserId = "user-1"): JhadinaWorkSession {
  return {
    id: "ws-1",
    ownerUserId,
    goal: "Continue with the uploaded files",
    status: "active",
    activeSubsystems: ["jllm"],
    artifactRefs: [
      { id: "clean-1", kind: "document", provenanceRef: "artifact:clean-1", admitted: true },
      { id: "pending-1", kind: "document", provenanceRef: "artifact:pending-1", admitted: false },
      { id: "stale-1", kind: "image", provenanceRef: "artifact:stale-1", admitted: true },
    ],
    decisionRefs: [],
    outputRefs: [],
    createdAt: "2026-09-22T12:00:00.000Z",
    updatedAt: "2026-09-22T12:05:00.000Z",
  }
}

function repository(value: JhadinaWorkSession | null): WorkSessionRepository {
  return { get: async () => value, save: async () => undefined }
}

describe("WorkSession artifact resume", () => {
  it("rehydrates only admitted refs and revalidates each through the clean resolver", async () => {
    const resolve = vi.fn(async ([ref]: Array<{ id: string }>) => {
      if (ref.id === "stale-1") throw new Error("ARTIFACT_CONTEXT_NOT_CLEAN")
      return [{
        id: ref.id,
        kind: "text" as const,
        mimeType: "text/plain",
        source: "durable-artifact" as const,
        name: `${ref.id}.txt`,
        observedAt: "2026-09-22T12:00:00.000Z",
        text: "clean body",
      }]
    })

    const result = await resolveWorkSessionArtifactContext({
      client: {} as never,
      ownerUserId: "user-1",
      workSessionId: "ws-1",
    }, {
      repository: repository(session()),
      resolver: { resolve },
    })

    expect(result.attemptedArtifactIds).toEqual(["clean-1", "stale-1"])
    expect(result.artifacts.map((artifact) => artifact.id)).toEqual(["clean-1"])
    expect(result.unavailableArtifactIds).toEqual(["stale-1"])
    expect(resolve).toHaveBeenCalledTimes(2)
  })

  it("does not rehydrate non-admitted refs or explicit refs already resolved this turn", async () => {
    const resolve = vi.fn(async ([ref]: Array<{ id: string }>) => [{
      id: ref.id,
      kind: "text" as const,
      mimeType: "text/plain",
      source: "durable-artifact" as const,
      observedAt: "2026-09-22T12:00:00.000Z",
      text: "body",
    }])

    const result = await resolveWorkSessionArtifactContext({
      client: {} as never,
      ownerUserId: "user-1",
      workSessionId: "ws-1",
      excludeArtifactIds: ["clean-1"],
    }, {
      repository: repository(session()),
      resolver: { resolve },
    })

    expect(result.attemptedArtifactIds).toEqual(["stale-1"])
    expect(resolve).not.toHaveBeenCalledWith([{ id: "pending-1" }])
    expect(resolve).not.toHaveBeenCalledWith([{ id: "clean-1" }])
  })

  it("returns no content for missing or cross-owner sessions", async () => {
    const resolve = vi.fn()

    const missing = await resolveWorkSessionArtifactContext({
      client: {} as never,
      ownerUserId: "user-1",
      workSessionId: "missing",
    }, { repository: repository(null), resolver: { resolve } })
    expect(missing.artifacts).toEqual([])

    const foreign = await resolveWorkSessionArtifactContext({
      client: {} as never,
      ownerUserId: "user-1",
      workSessionId: "ws-1",
    }, { repository: repository(session("user-2")), resolver: { resolve } })
    expect(foreign.artifacts).toEqual([])
    expect(resolve).not.toHaveBeenCalled()
  })

  it("treats stale session artifacts as unavailable instead of blocking the Ask turn", async () => {
    const resolve = vi.fn(async () => {
      throw new Error("ARTIFACT_CONTEXT_NOT_FOUND")
    })
    const result = await resolveWorkSessionArtifactContext({
      client: {} as never,
      ownerUserId: "user-1",
      workSessionId: "ws-1",
    }, {
      repository: repository(session()),
      resolver: { resolve },
    })

    expect(result.artifacts).toEqual([])
    expect(result.unavailableArtifactIds).toEqual(["clean-1", "stale-1"])
  })
})
