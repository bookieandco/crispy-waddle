import { describe, expect, it } from "vitest"
import type { MoneyDomainContext } from "@jhadina/core-spine"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { TimelineRepository } from "../repositories/TimelineRepository"
import { InMemoryStorage } from "../storage/InMemoryStorage"
import { buildContext } from "./context-builder"

function moneyContext(): MoneyDomainContext {
  return {
    market: [{
      id: "money-market:AAPL",
      source: "alpaca-market-data",
      observedAt: "2026-09-26T20:00:00.000Z",
      summary: "AAPL bid 200 / ask 200.1; baseline HOLD; MIMS REVIEW.",
      immutable: true,
    }],
    watchlist: [{
      id: "money-watch:AAPL",
      source: "money:watchlist",
      observedAt: "2026-09-26T19:00:00.000Z",
      summary: "AAPL is on the user's Money watchlist.",
      immutable: false,
    }],
    paperActivity: [],
    learning: [],
    alerts: [],
    attention: [],
    uncertainty: [],
    limitations: ["Money context is read-only."],
    provenance: [],
  }
}

describe("Ask Jhadina Money context integration", () => {
  it("attaches governed Money evidence without creating trading authority", async () => {
    const storage = new InMemoryStorage()
    const assembled = await buildContext({
      memoryRepo: new MemoryRepository(storage),
      timelineRepo: new TimelineRepository(storage),
      moneyContextProvider: { getContext: async () => moneyContext() },
    }, {
      userId: "user-1",
      activeTask: "What is your read on AAPL?",
      surface: "assistant",
      route: "/ask-jhadina",
    })

    expect(assembled.contextPacket.domainContext?.money?.market[0]?.id).toBe("money-market:AAPL")
    expect(assembled.contextPacket.domainContext?.money?.watchlist[0]?.id).toBe("money-watch:AAPL")
    expect(assembled.contextPacket.domainContext?.money?.limitations).toContain("Money context is read-only.")
    expect(assembled.contextPacket.excludedContext).toContain("money: Money context is read-only.")
  })

  it("does not invent a Money domain when its provider returns undefined", async () => {
    const storage = new InMemoryStorage()
    const assembled = await buildContext({
      memoryRepo: new MemoryRepository(storage),
      timelineRepo: new TimelineRepository(storage),
      moneyContextProvider: { getContext: async () => undefined },
    }, {
      userId: "user-1",
      activeTask: "hello",
    })

    expect(assembled.contextPacket.domainContext?.money).toBeUndefined()
  })
})
