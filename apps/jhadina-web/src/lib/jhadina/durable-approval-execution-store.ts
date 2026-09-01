import type { ApprovalExecutionRecord, ApprovalExecutionStore } from "@jhadina/connector-core"
import { createServiceRoleClient } from "../supabase/service-role"

type Row = {
  approval_id: string
  proposal_hash: string
  state: "executing" | "succeeded" | "failed"
  started_at: string
  completed_at: string | null
  error: string | null
}

/** Server-only durable execution claim store. */
export class SupabaseApprovalExecutionStore implements ApprovalExecutionStore {
  constructor(private readonly supabase = createServiceRoleClient()) {}

  async begin(approvalId: string, proposalHash: string, now = new Date()): Promise<boolean> {
    if (!this.supabase) throw new Error("Supabase service-role client is not configured")
    const { error } = await this.supabase
      .from("jhadina_connector_execution_ledger")
      .insert({ approval_id: approvalId, proposal_hash: proposalHash, state: "executing", started_at: now.toISOString() })
    if (!error) return true
    if (error.code === "23505") return false
    throw new Error(`Failed to claim approval execution: ${error.message}`)
  }

  async complete(approvalId: string, now = new Date()): Promise<void> {
    await this.transition(approvalId, "succeeded", now)
  }

  async fail(approvalId: string, error: string, now = new Date()): Promise<void> {
    if (!this.supabase) throw new Error("Supabase service-role client is not configured")
    const { data, error: dbError } = await this.supabase
      .from("jhadina_connector_execution_ledger")
      .update({ state: "failed", error, completed_at: now.toISOString(), updated_at: now.toISOString() })
      .eq("approval_id", approvalId)
      .eq("state", "executing")
      .select("approval_id")
    if (dbError) throw new Error(`Failed to record approval execution failure: ${dbError.message}`)
    if (!data?.length) throw new Error(`Approval execution cannot fail: ${approvalId}`)
  }

  async get(approvalId: string): Promise<ApprovalExecutionRecord | undefined> {
    if (!this.supabase) throw new Error("Supabase service-role client is not configured")
    const { data, error } = await this.supabase
      .from("jhadina_connector_execution_ledger")
      .select("approval_id, proposal_hash, state, started_at, completed_at, error")
      .eq("approval_id", approvalId)
      .maybeSingle<Row>()
    if (error) throw new Error(`Failed to read approval execution: ${error.message}`)
    return data ? mapRow(data) : undefined
  }

  async recoverStale(approvalId: string, staleBefore: Date): Promise<boolean> {
    if (!this.supabase) throw new Error("Supabase service-role client is not configured")
    const { data, error } = await this.supabase
      .from("jhadina_connector_execution_ledger")
      .delete()
      .eq("approval_id", approvalId)
      .eq("state", "executing")
      .lte("started_at", staleBefore.toISOString())
      .select("approval_id")
    if (error) throw new Error(`Failed to recover stale approval execution: ${error.message}`)
    return Boolean(data?.length)
  }

  async consume(approvalId: string): Promise<boolean> {
    return this.begin(approvalId, `legacy:${approvalId}`)
  }

  private async transition(approvalId: string, state: "succeeded", now: Date): Promise<void> {
    if (!this.supabase) throw new Error("Supabase service-role client is not configured")
    const { data, error } = await this.supabase
      .from("jhadina_connector_execution_ledger")
      .update({ state, completed_at: now.toISOString(), updated_at: now.toISOString() })
      .eq("approval_id", approvalId)
      .eq("state", "executing")
      .select("approval_id")
    if (error) throw new Error(`Failed to complete approval execution: ${error.message}`)
    if (!data?.length) throw new Error(`Approval execution cannot complete: ${approvalId}`)
  }
}

function mapRow(row: Row): ApprovalExecutionRecord {
  return {
    approvalId: row.approval_id,
    proposalHash: row.proposal_hash,
    state: row.state,
    startedAt: row.started_at,
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
    ...(row.error ? { error: row.error } : {}),
  }
}
