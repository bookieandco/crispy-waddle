import type { ID, TimelineEvent } from "./index";

export interface PlanningTimelineReader {
  listTimeline(planId: ID): Promise<TimelineEvent[]>;
}

export interface PlanningTimelineDatabaseClient {
  from(table: string): {
    select(columns?: string): PlanningTimelineQuery;
  };
}

export interface PlanningTimelineQuery {
  eq(column: string, value: unknown): PlanningTimelineQuery;
  order(column: string, options?: { ascending?: boolean }): PlanningTimelineQuery;
  then<TResult1 = { data: Record<string, unknown>[] | null; error: Error | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Record<string, unknown>[] | null; error: Error | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2>;
}

export class SupabasePlanningTimelineReader implements PlanningTimelineReader {
  constructor(private readonly db: PlanningTimelineDatabaseClient) {}

  async listTimeline(planId: ID): Promise<TimelineEvent[]> {
    const result = await this.db
      .from("jhadina_planning_events")
      .select("id,event_type,occurred_at,payload")
      .eq("plan_id", planId)
      .order("occurred_at", { ascending: true });

    if (result.error) throw result.error;

    return (result.data ?? []).map((row) => ({
      id: String(row.id),
      timestamp: String(row.occurred_at),
      title: String(row.event_type),
      description: typeof row.payload === "object" && row.payload !== null
        ? String((row.payload as Record<string, unknown>).description ?? "") || undefined
        : undefined,
      metadata: typeof row.payload === "object" && row.payload !== null
        ? (row.payload as Record<string, unknown>)
        : undefined,
    }));
  }
}
