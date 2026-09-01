import type {
  ApprovalExecutionRecord,
  ApprovalExecutionStore,
  ConnectorExecutionRecord,
  ConnectorExecutionStore,
  ConnectorResponse,
} from "@jhadina/connector-core"
import { createServiceRoleClient } from "../supabase/service-role"

type Row = {
  execution_id: string
  approval_id: string | null
  proposal_id: string | null
  proposal_hash: string
  idempotency_key: string | null
  connector_id: string | null
  operation: string | null
  actor_id: string | null
  correlation_id: string | null
  state: "executing" | "succeeded" | "failed" | "recovery_required"
  response: ConnectorResponse | null
  error: string | null
  started_at: string
  completed_at: string | null
}

/** Server-only durable connector execution store. The service-role client must never reach a browser bundle. */
export class SupabaseConnectorExecutionStore implements ConnectorExecutionStore {
  constructor(private readonly supabase = createServiceRoleClient()) {}

  async getByIdempotencyKey(idempotencyKey: string): Promise<ConnectorExecutionRecord | undefined> {
    if (!this.supabase) throw new Error("Supabase service-role client is not configured")
    const { data, error } = await this.supabase
      .from("jhadina_connector_execution_ledger")
      .select("execution_id, approval_id, proposal_id, proposal_hash, idempotency_key, connector_id, operation, actor_id, correlation_id, state, response, error, started_at, completed_at")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle<Row>()
    if (error) throw new Error(`Failed to read connector execution: ${error.message}`)
    return data ? mapConnectorRow(data) : undefined
  }

  async begin(record: Omit<ConnectorExecutionRecord, "state" | "startedAt" | "completedAt" | "response" | "error"> & { state?: "executing"; startedAt?: string }): Promise<boolean> {
    if (!this.supabase) throw new Error("Supabase service-role client is not configured")
    const { error } = await this.supabase.from("jhadina_connector_execution_ledger").insert({
      execution_id: record.executionId,
      approval_id: record.approvalId ?? null,
      proposal_id: record.proposalId ?? null,
      proposal_hash: record.proposalHash,
      idempotency_key: record.idempotencyKey,
      connector_id: record.connectorId,
      operation: record.operation,
      capability: undefined,
      actor_id: record.actorId,
      correlation_id: record.correlationId,
      state: "executing",
      started_at: record.startedAt ?? new Date().toISOString(),
    })
    if (!error) return true
    if (error.code === "23505") return false
    throw new Error(`Failed to claim connector execution: ${error.message}`)
  }

  async complete(executionId: string, proposalHash: string, response: ConnectorResponse, now = new Date()): Promise<void> {
    await this.transition(executionId, proposalHash, { state: "succeeded", response, error: null }, now)
  }

  async fail(executionId: string, proposalHash: string, error: string, response: ConnectorResponse, now = new Date()): Promise<void> {
    await this.transition(executionId, proposalHash, { state: "failed", response, error }, now)
  }

  private async transition(executionId: string, proposalHash: string, values: { state: "succeeded" | "failed"; response: ConnectorResponse; error: string | null }, now: Date): Promise<void> {
    if (!this.supabase) throw new Error("Supabase service-role client is not configured")
    const { data, error } = await this.supabase
      .from("jhadina_connector_execution_ledger")
      .update({ state: values.state, response: values.response, error: values.error, completed_at: now.toISOString(), updated_at: now.toISOString() })
      .eq("execution_id", executionId)
      .eq("proposal_hash", proposalHash)
      .eq("state", "executing")
      .select("execution_id")
    if (error) throw new Error(`Failed to persist connector execution: ${error.message}`)
    if (!data?.length) throw new Error(`Connector execution cannot transition: ${executionId}`)
  }
}

/** Backward-compatible approval claim store backed by the same durable ledger. */
export class SupabaseApprovalExecutionStore implements ApprovalExecutionStore {
  constructor(private readonly supabase = createServiceRoleClient()) {}

  async begin(approvalId: string, proposalHash: string, now = new Date()): Promise<boolean> {
    if (!this.supabase) throw new Error("Supabase service-role client is not configured")
    const { error } = await this.supabase.from("jhadina_connector_execution_ledger").insert({ approval_id: approvalId, proposal_hash: proposalHash, state: "executing", started_at: now.toISOString() })
    if (!error) return true
    if (error.code === "23505") return false
    throw new Error(`Failed to claim approval execution: ${error.message}`)
  }

  async complete(approvalId: string, now = new Date()): Promise<void> { await this.transition(approvalId, "succeeded", now) }

  async fail(approvalId: string, error: string, now = new Date()): Promise<void> {
    if (!this.supabase) throw new Error("Supabase service-role client is not configured")
    const { data, error: dbError } = await this.supabase.from("jhadina_connector_execution_ledger").update({ state: "failed", error, completed_at: now.toISOString(), updated_at: now.toISOString() }).eq("approval_id", approvalId).eq("state", "executing").select("approval_id")
    if (dbError) throw new Error(`Failed to record approval execution failure: ${dbError.message}`)
    if (!data?.length) throw new Error(`Approval execution cannot fail: ${approvalId}`)
  }

  async get(approvalId: string): Promise<ApprovalExecutionRecord | undefined> {
    if (!this.supabase) throw new Error("Supabase service-role client is not configured")
    const { data, error } = await this.supabase.from("jhadina_connector_execution_ledger").select("approval_id, proposal_hash, state, started_at, completed_at, error").eq("approval_id", approvalId).maybeSingle<{ approval_id: string; proposal_hash: string; state: "executing" | "succeeded" | "failed" | "recovery_required"; started_at: string; completed_at: string | null; error: string | null }>()
    if (error) throw new Error(`Failed to read approval execution: ${error.message}`)
    return data ? { approvalId: data.approval_id, proposalHash: data.proposal_hash, state: data.state, startedAt: data.started_at, ...(data.completed_at ? { completedAt: data.completed_at } : {}), ...(data.error ? { error: data.error } : {}) } : undefined
  }

  async recoverStale(approvalId: string, staleBefore: Date): Promise<boolean> {
    if (!this.supabase) throw new Error("Supabase service-role client is not configured")
    const { data, error } = await this.supabase
      .from("jhadina_connector_execution_ledger")
      .update({ state: "recovery_required", error: "Execution became stale and requires provider reconciliation before retry", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("approval_id", approvalId)
      .eq("state", "executing")
      .lte("started_at", staleBefore.toISOString())
      .select("approval_id")
    if (error) throw new Error(`Failed to mark stale approval execution: ${error.message}`)
    return Boolean(data?.length)
  }

  async consume(approvalId: string): Promise<boolean> { return this.begin(approvalId, `legacy:${approvalId}`) }

  private async transition(approvalId: string, state: "succeeded", now: Date): Promise<void> {
    if (!this.supabase) throw new Error("Supabase service-role client is not configured")
    const { data, error } = await this.supabase.from("jhadina_connector_execution_ledger").update({ state, completed_at: now.toISOString(), updated_at: now.toISOString() }).eq("approval_id", approvalId).eq("state", "executing").select("approval_id")
    if (error) throw new Error(`Failed to complete approval execution: ${error.message}`)
    if (!data?.length) throw new Error(`Approval execution cannot complete: ${approvalId}`)
  }
}

function mapConnectorRow(row: Row): ConnectorExecutionRecord {
  return {
    executionId: row.execution_id,
    ...(row.approval_id ? { approvalId: row.approval_id } : {}),
    ...(row.proposal_id ? { proposalId: row.proposal_id } : {}),
    proposalHash: row.proposal_hash,
    idempotencyKey: row.idempotency_key ?? "",
    connectorId: row.connector_id ?? "",
    operation: row.operation ?? "",
    actorId: row.actor_id ?? "",
    correlationId: row.correlation_id ?? "",
    state: row.state === "recovery_required" ? "executing" : row.state,
    ...(row.response ? { response: row.response } : {}),
    ...(row.error ? { error: row.error } : {}),
    startedAt: row.started_at,
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
  }
}
