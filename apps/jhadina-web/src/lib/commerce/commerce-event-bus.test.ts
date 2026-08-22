import { describe, it, expect } from "vitest"
import { InMemoryCommerceEventBus, commerceEventId, type CommerceEvent } from "./commerce-event-bus"

function event(overrides: Partial<CommerceEvent> = {}): CommerceEvent {
  return {
    id: commerceEventId("proposal_created", "proposal-1"),
    type: "proposal_created",
    proposalId: "proposal-1",
    capability: "commerce.payment.charge",
    actorId: "user-1",
    occurredAt: "2026-01-01T00:00:00.000Z",
    payload: { amountMinor: 1500, currency: "usd" },
    ...overrides,
  }
}

describe("InMemoryCommerceEventBus", () => {
  it("records a published event and returns it from list()", async () => {
    const bus = new InMemoryCommerceEventBus()
    await bus.publish(event())

    expect(bus.list()).toHaveLength(1)
    expect(bus.list()[0]).toMatchObject({ type: "proposal_created", proposalId: "proposal-1" })
  })

  it("is idempotent by event id: the same id published twice is recorded once (duplicate events)", async () => {
    const bus = new InMemoryCommerceEventBus()
    await bus.publish(event())
    await bus.publish(event())
    await bus.publish(event({ payload: { amountMinor: 999_999, currency: "usd" } }))

    expect(bus.list()).toHaveLength(1)
    expect(bus.list()[0]?.payload).toEqual({ amountMinor: 1500, currency: "usd" })
  })

  it("records distinct events for distinct ids, in publish order", async () => {
    const bus = new InMemoryCommerceEventBus()
    await bus.publish(event({ id: commerceEventId("proposal_created", "proposal-1"), type: "proposal_created" }))
    await bus.publish(event({ id: commerceEventId("approval_granted", "proposal-1"), type: "approval_granted" }))

    expect(bus.list().map((e) => e.type)).toEqual(["proposal_created", "approval_granted"])
  })

  it("list() returns defensive copies — mutating a returned event never affects the bus's own record", async () => {
    const bus = new InMemoryCommerceEventBus()
    await bus.publish(event())

    const first = bus.list()[0]
    if (first) first.actorId = "tampered"

    expect(bus.list()[0]?.actorId).toBe("user-1")
  })
})

describe("commerceEventId", () => {
  it("is deterministic for the same type and proposal id", () => {
    expect(commerceEventId("execution_succeeded", "proposal-1")).toBe(commerceEventId("execution_succeeded", "proposal-1"))
  })

  it("differs across event types for the same proposal", () => {
    expect(commerceEventId("proposal_created", "proposal-1")).not.toBe(commerceEventId("approval_granted", "proposal-1"))
  })

  it("differs across proposals for the same event type", () => {
    expect(commerceEventId("proposal_created", "proposal-1")).not.toBe(commerceEventId("proposal_created", "proposal-2"))
  })
})
