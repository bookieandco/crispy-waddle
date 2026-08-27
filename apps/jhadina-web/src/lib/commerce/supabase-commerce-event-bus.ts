import type { CommerceEvent, CommerceEventBus } from "./commerce-event-bus"
import { createClient } from "../supabase/server"

/**
 * Request-scoped production CommerceEventBus. Mirrors
 * supabase-commerce-proposal-store.ts's own shape: every write goes
 * through a security-definer RPC that stamps actor_id from auth.uid()
 * (never trusted from the event itself), and idempotency (on conflict
 * do nothing, keyed by the event's own id) is enforced by the database,
 * not just the in-memory reference implementation.
 */
export function createSupabaseCommerceEventBus(): CommerceEventBus {
  return {
    async publish<TPayload = Record<string, unknown>>(event: CommerceEvent<TPayload>): Promise<void> {
      const supabase = await createClient()
      const { error } = await supabase.rpc("jhadina_commerce_publish_event", {
        p_id: event.id,
        p_proposal_id: event.proposalId,
        p_capability: event.capability,
        p_type: event.type,
        p_occurred_at: event.occurredAt,
        p_payload: event.payload,
      })

      if (error) throw new Error(`Unable to publish commerce event: ${error.message}`)
    },
  }
}
