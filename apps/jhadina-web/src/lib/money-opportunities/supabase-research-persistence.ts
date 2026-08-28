import type { MoneyResearchPersistence } from "./research-persistence"
import type { PlannedResearchCase } from "./research-planner"
import { researchCaseKey } from "./research-case-key"
import { preserveResearchTaskState, researchTaskPriority } from "./research-task-priority"
import type { PersistedResearchCase } from "./research-case-persistence-result"
import type { MoneyResearchTaskPersistence } from "./research-task-persistence"

type SupabaseClient = {
  from(table: string): {
    upsert(values: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string; ignoreDuplicates?: boolean }): {
      select(columns?: string): {
        single(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>
      }
    }
  }
}

export class SupabaseMoneyResearchPersistence implements MoneyResearchPersistence, MoneyResearchTaskPersistence {
  constructor(private readonly supabase: SupabaseClient) {}

  async saveResearchCase(input: PlannedResearchCase): Promise<PersistedResearchCase> {
    const opportunityId = researchCaseKey(input.opportunityId)
    const { data, error } = await this.supabase
      .from("money_research_cases")
      .upsert({
        opportunity_id: opportunityId,
        source: input.source,
        title: input.title,
        action: input.action,
        priority: input.priority,
        estimated_value: input.estimatedValue,
        estimated_margin_percent: input.estimatedMarginPercent,
      }, { onConflict: "opportunity_id" })
      .select("id, opportunity_id")
      .single()

    if (error || !data?.id || !data?.opportunity_id) {
      throw new Error(error?.message || "Research case upsert did not return an id")
    }

    for (const branch of input.branches) {
      const status = branch.status
      const state = preserveResearchTaskState({ plannedStatus: status })
      await this.upsertResearchTask({
        researchCaseId: String(data.id),
        branch,
        priority: researchTaskPriority(state.status),
      })
    }

    return { id: String(data.id), opportunityId: String(data.opportunity_id) }
  }

  async upsertResearchTask(input: {
    researchCaseId: string
    branch: PlannedResearchCase["branches"][number]
    priority: number
  }): Promise<{ id: string }> {
    const state = preserveResearchTaskState({ plannedStatus: input.branch.status })
    const { data, error } = await this.supabase
      .from("money_research_tasks")
      .upsert({
        research_case_id: input.researchCaseId,
        branch: input.branch.kind,
        question: input.branch.question,
        status: state.status,
        priority: state.status === "READY" ? 10 : input.priority,
      }, { onConflict: "research_case_id,branch" })
      .select("id")
      .single()

    if (error || !data?.id) throw new Error(error?.message || "Research task upsert did not return an id")
    return { id: String(data.id) }
  }
}
