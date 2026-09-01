import type {
  ApprovalExecutionRecord,
  ApprovalExecutionStore,
} from "@jhadina/connector-core"
import { createServiceRoleClient } from "../supabase/service-role"

type Row = {
  approval_id: string
  proposal_hash: string
  state: "executing" | "succeeded" | "failed"
  started_at: string
  completed_at: string | null
  error: string | null
}

/**
 * Server-only durable execution claim store.
 *
 * The unique approval_id constraint makes begin() an atomic compare-and-claim
 * boundary across multiple Jhadina instances. This client must never be
 * imported into browser code because it uses the service-role key.
 */
export class SupabaseApprovalExecutionStore implements ApprovalExecutionStore {
  constructor(private readonly supabase = createServiceRoleClient()) {}

  begin(approvalId: string, proposalHash: string, now = new Date()): boolean {
    throw new Error("SupabaseApprovalExecutionStore.begin must be awaited via beginAsync")
  }

  async beginAsync(approvalId: string, proposalHash: string, now = new Date()): Promise<boolean> {
    if (!this.supabase) throw new Error("Supabase service-role client is not configured")
    const { error } = await this.supabase
      .from("jhadina_connector_execution_ledger")
      .insert({ approval_id: approvalId, proposal_hash: proposalHash, state: "executing", started_at: now.toISOString() })
    if (!error) return true
    if (error.code === "23505") return false
    throw new Error(`Failed to claim approval execution: ${error.message}`)
  }

  complete(approvalId: string, now = new Date()): void {
    throw new Error("SupabaseApprovalExecutionStore.complete must be awaited via completeAsync")
  }

  async completeAsync(approvalId: string, now = new Date()): Promise<void> {
    await this.transition(approvalId, "succeeded", now)
  }

  fail(approvalId: string, error: string, now = new Date()): void {
    throw new Error("SupabaseApprovalExecutionStore.fail must be awaited via failAsync")
  }

  async failAsync(approvalId: string, error: string, now = new Date()): Promise<void> {
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

  get(approvalId: string): ApprovalExecutionRecord | undefined {
    throw new Error("SupabaseApprovalExecutionStore.get must be awaited via getAsync")
  }

  async getAsync(approvalId: string): Promise<ApprovalExecutionRecord | undefined> {
    if (!this.supabase) throw new Error("Supabase service-role client is not configured")
    const { data, error } = await this.supabase
      .from("jhadina_connector_execution_ledger")
      .select("approval_id, proposal_hash, state, started_at, completed_at, error")
      .eq("approval_id", approvalId)
      .maybeSingle<Row>()
    if (error) throw new Error(`Failed to read approval execution: ${error.message}`)
    return data ? mapRow(data) : undefined
  }

  recoverStale(approvalId: string, staleBefore: Date): boolean {
    throw new Error("SupabaseApprovalExecutionStore.recoverStale must be awaited via recoverStaleAsync")
  }

  async recoverStaleAsync(approvalId: string, staleBefore: Date): Promise<boolean> {
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

  consume(approvalId: string): boolean {
    throw new Error("SupabaseApprovalExecutionStore.consume must be awaited via beginAsync")
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
