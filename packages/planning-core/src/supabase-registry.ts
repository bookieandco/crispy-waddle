import type {
  ID,
  PlanningPlan,
  PlanningProposal,
  PlanningRegistry,
} from "./index";

export interface PlanningDatabaseClient {
  from(table: string): {
    select(columns?: string): PlanningQuery;
    insert(values: Record<string, unknown> | Record<string, unknown>[]): PlanningQuery;
  };
}

export interface PlanningQuery {
  eq(column: string, value: unknown): PlanningQuery;
  order(column: string, options?: { ascending?: boolean }): PlanningQuery;
  single(): Promise<{ data: Record<string, unknown> | null; error: Error | null }>;
  then<TResult1 = { data: Record<string, unknown>[] | null; error: Error | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Record<string, unknown>[] | null; error: Error | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2>;
}

interface PlanRow {
  id: string;
  name: string;
  version: number;
  document: PlanningPlan;
}

interface ProposalRow {
  id: string;
  plan_id: string;
  description: string;
  requested_at: string;
  requested_by: string;
  action_type: string;
  payload: Record<string, unknown>;
}

export class SupabasePlanningRegistry implements PlanningRegistry {
  constructor(private readonly db: PlanningDatabaseClient) {}

  async getPlan(id: ID): Promise<PlanningPlan | null> {
    const result = await this.db
      .from("jhadina_plans")
      .select("id,name,version,document")
      .eq("id", id)
      .single();

    if (result.error) throw result.error;
    if (!result.data) return null;

    return (result.data as unknown as PlanRow).document;
  }

  async savePlan(plan: PlanningPlan): Promise<void> {
    const result = await this.db.from("jhadina_plans").insert({
      id: plan.id,
      name: plan.name,
      version: plan.version,
      document: plan,
    });

    if (result.error) throw result.error;
  }

  async listPlans(): Promise<PlanningPlan[]> {
    const result = await this.db
      .from("jhadina_plans")
      .select("id,name,version,document")
      .order("updated_at", { ascending: false });

    if (result.error) throw result.error;

    return (result.data ?? []).map(
      (row) => (row as unknown as PlanRow).document,
    );
  }

  async createProposal(proposal: PlanningProposal): Promise<void> {
    const result = await this.db.from("jhadina_planning_proposals").insert({
      id: proposal.id,
      plan_id: proposal.planId,
      description: proposal.description,
      requested_at: proposal.requestedAt,
      requested_by: proposal.requestedBy,
      action_type: proposal.actionType,
      payload: proposal.payload,
    });

    if (result.error) throw result.error;
  }
}
