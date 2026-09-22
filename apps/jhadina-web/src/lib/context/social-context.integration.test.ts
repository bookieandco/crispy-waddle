import { describe, expect, it } from "vitest"
import type { SocialDomainContext } from "@jhadina/core-spine"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { TimelineRepository } from "../repositories/TimelineRepository"
import { InMemoryStorage } from "../storage/InMemoryStorage"
import { buildContext, type ContextBuilderDeps } from "./context-builder"

function deps(): ContextBuilderDeps {
  const storage = new InMemoryStorage()
  const social: SocialDomainContext = {
    accounts: [{
      id: "social-account:acct-1",
      source: "social-account",
      observedAt: "2026-09-22T12:00:00.000Z",
      summary: "PupsonStuff Instagram; accountId=acct-1",
      immutable: false,
    }],
    characters: [{
      id: "character:pupsonstuff",
      source: "social-character-registry",
      observedAt: "2026-09-22T12:00:00.000Z",
      summary: "PupsonStuff character; authority=EXPRESSION_ONLY",
      immutable: true,
    }],
    pendingWork: [],
    performance: [],
    attention: [],
    uncertainty: [],
    limitations: [],
    provenance: [],
  }

  return {
    memoryRepo: new MemoryRepository(storage),
    timelineRepo: new TimelineRepository(storage),
    socialContextProvider: {
      getContext: async () => social,
    },
  }
}

describe("Ask Jhadina Social context integration", () => {
  it("adds Social context to the canonical ContextPacket without changing execution authority", async () => {
    const assembled = await buildContext(deps(), {
      userId: "user-1",
      activeTask: "Which social account should I work on?",
      surface: "assistant",
      route: "/ask-jhadina",
    })

    expect(assembled.contextPacket.domainContext?.social?.accounts[0]?.id).toBe("social-account:acct-1")
    expect(assembled.contextPacket.domainContext?.social?.characters[0]?.id).toBe("character:pupsonstuff")
    expect(assembled.contextPacket.domainContext?.social?.characters[0]?.summary).toContain("EXPRESSION_ONLY")
  })

  it("keeps domainContext absent when no Social or Spatial provider is composed", async () => {
    const storage = new InMemoryStorage()
    const assembled = await buildContext({
      memoryRepo: new MemoryRepository(storage),
      timelineRepo: new TimelineRepository(storage),
    }, {
      userId: "user-1",
      activeTask: "hello",
    })

    expect(assembled.contextPacket.domainContext).toBeUndefined()
  })
})
