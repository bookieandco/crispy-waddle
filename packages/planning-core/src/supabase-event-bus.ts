import type { ID } from "./index";
import type { PlanningEvent, PlanningEventBus } from "./events";

export interface PlanningEventDatabaseClient {
  from(table: string): {
    insert(values: Record<string, unknown>): PromiseLike<{ error: Error | null }>;
  };
}

export class SupabasePlanningEventBus implements PlanningEventBus {
  constructor(private readonly db: PlanningEventDatabaseClient) {}

  async publish(event: PlanningEvent): Promise<void> {
    const result = await this.db.from("jhadina_planning_events").insert({
      id: event.id,
      plan_id: event.planId,
      event_type: event.type,
      occurred_at: event.occurredAt,
      actor_id: event.actorId,
      payload: event.payload,
    });

    if (result.error) throw result.error;
  }
}

export function planningEventId(prefix: string, id: ID): string {
  return `${prefix}:${id}`;
}
