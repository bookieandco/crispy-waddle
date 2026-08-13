import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlacementEventSink } from "./vertical-slice.js";

export interface PlacementAuditContext {
  actorUserId: string;
  organizationId?: string;
  requestId?: string;
}

/** Persists domain events without allowing the event sink to mutate domain state. */
export class SupabasePlacementEventSink implements PlacementEventSink {
  constructor(
    private readonly db: SupabaseClient,
    private readonly context: PlacementAuditContext,
  ) {}

  async publish(event: unknown): Promise<void> {
    const eventRecord = event as { type?: string };
    const { error } = await this.db.from("placement_audit_events").insert({
      actor_user_id: this.context.actorUserId,
      organization_id: this.context.organizationId ?? null,
      request_id: this.context.requestId ?? null,
      event_type: eventRecord.type ?? "UNKNOWN",
      payload: event,
    });
    if (error) throw error;
  }
}
