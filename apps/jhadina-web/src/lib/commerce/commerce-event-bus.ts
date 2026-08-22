/**
 * Step 8: Commerce's Event Bus — records and distributes what already
 * happened in the governed proposal lifecycle. It is deliberately NOT
 * a permission system:
 *
 *   - Event Bus: records/distributes what happened (this file).
 *   - Capability Registry (commerce-capability-registry.ts): describes
 *     what an actor can potentially request.
 *   - Policy/enforcement (SecurityCoreActionPolicy + the approval-
 *     receipt lifecycle in commerce-proposal-lifecycle.ts): the sole
 *     authority that decides whether an action is allowed.
 *
 * Nothing in this file evaluates policy, issues or consumes a receipt,
 * or calls a PaymentProvider. Every publish() call in
 * commerce-proposal-lifecycle.ts happens strictly AFTER the real
 * decision (policy evaluation, approval, or receipt consumption) has
 * already been made — the bus cannot become an alternate path around
 * authorization because it never runs before that decision, only after
 * it, and its own publish() has no side effect any caller depends on
 * for correctness (skipping a publish never lets an unauthorized action
 * proceed; the reverse — publishing without the underlying action
 * having actually happened — is the failure mode this design avoids by
 * only ever calling publish() with the real, already-produced result in
 * hand).
 *
 * Mirrors planning-core's own PlanningEventBus/InMemoryPlanningEventBus
 * shape (packages/planning-core/src/events.ts) — publish-only interface,
 * in-memory + durable implementations — rather than inventing a
 * different one. Commerce gets its own copy rather than importing
 * Planning's (which is hard-typed to planId/PlanningEventType) for the
 * same reason Commerce never imports Money Core's primitives: no
 * cross-domain package reach for a domain-shaped type.
 */

export const COMMERCE_EVENT_TYPES = [
  "proposal_created",
  "approval_granted",
  "execution_started",
  "execution_succeeded",
  "execution_failed",
  "replay_rejected",
] as const

export type CommerceEventType = (typeof COMMERCE_EVENT_TYPES)[number]

export interface CommerceEvent<TPayload = Record<string, unknown>> {
  /** Unique per logical occurrence — used to make publish() idempotent (see "duplicate events" below). */
  id: string
  type: CommerceEventType
  proposalId: string
  capability: string
  actorId: string
  occurredAt: string
  payload: TPayload
}

export interface CommerceEventBus {
  /**
   * Idempotent by event.id: publishing the same id twice must record it
   * only once. A caller (or a network retry) that publishes the same
   * logical event more than once must never cause a duplicate delivery.
   */
  publish<TPayload = Record<string, unknown>>(event: CommerceEvent<TPayload>): Promise<void>
}

/**
 * Reference/test implementation. Production composition uses
 * createSupabaseCommerceEventBus() (supabase-commerce-event-bus.ts)
 * instead — this exists so the governed lifecycle functions and their
 * tests never depend on a live database, exactly like every other
 * in-memory reference store in this domain.
 */
export class InMemoryCommerceEventBus implements CommerceEventBus {
  private readonly events = new Map<string, CommerceEvent>()

  async publish<TPayload = Record<string, unknown>>(event: CommerceEvent<TPayload>): Promise<void> {
    if (this.events.has(event.id)) return
    this.events.set(event.id, structuredClone(event) as CommerceEvent)
  }

  list(): CommerceEvent[] {
    return [...this.events.values()].map((event) => structuredClone(event))
  }
}

/** Deterministic per lifecycle stage — never random, so a genuine retry of the same stage naturally dedupes via CommerceEventBus's idempotent publish(). */
export function commerceEventId(type: CommerceEventType, proposalId: string): string {
  return `commerce-event:${proposalId}:${type}`
}
