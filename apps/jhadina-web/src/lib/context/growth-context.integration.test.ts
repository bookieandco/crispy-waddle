import { describe, expect, it } from "vitest"
import type { GrowthDomainContext, SocialDomainContext } from "@jhadina/core-spine"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { TimelineRepository } from "../repositories/TimelineRepository"
import { InMemoryStorage } from "../storage/InMemoryStorage"
import { buildContext, type ContextBuilderDeps } from "./context-builder"

function deps(): ContextBuilderDeps {
  const storage = new InMemoryStorage()

  const social: SocialDomainContext = {
    accounts: [{
      id: "social-account:1",
      source: "social-account",
      observedAt: "2026-09-22T12:00:00.000Z",
      summary: "PupsonStuff Instagram",
      immutable: false,
    }],
    characters: [],
    pendingWork: [],
    performance: [],
    attention: [],
    uncertainty: [],
    limitations: [],
    provenance: [],
  }

  const growth: GrowthDomainContext = {
    campaigns: [{
      id: "growth-campaign:1",
      source: "growth-paid-campaign",
      observedAt: "2026-09-22T12:00:00.000Z",
      summary: "PupsonStuff Meta campaign; status=delivered",
      immutable: false,
    }],
    audiences: [],
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
    socialContextProvider: { getContext: async () => social },
    growthContextProvider: { getContext: async () => growth },
  }
}

describe("Ask Jhadina Growth context integration", () => {
  it("composes Growth beside Social without overwriting either domain", async () => {
    const assembled = await buildContext(deps(), {
      userId: "user-1",
      activeTask: "How are my social accounts and paid campaigns doing?",
      surface: "assistant",
      route: "/ask-jhadina",
    })

    expect(assembled.contextPacket.domainContext?.social?.accounts[0]?.id).toBe("social-account:1")
    expect(assembled.contextPacket.domainContext?.growth?.campaigns[0]?.id).toBe("growth-campaign:1")
  })

  it("does not invent a Growth domain when its provider returns undefined", async () => {
    const storage = new InMemoryStorage()
    const assembled = await buildContext({
      memoryRepo: new MemoryRepository(storage),
      timelineRepo: new TimelineRepository(storage),
      growthContextProvider: { getContext: async () => undefined },
    }, {
      userId: "user-1",
      activeTask: "hello",
    })

    expect(assembled.contextPacket.domainContext?.growth).toBeUndefined()
  })
})
