import type { ConnectorReconciliationEvidence, ConnectorReconciliationStore } from "@jhadina/connector-core"
import { createServiceRoleClient } from "../supabase/service-role"

type Row = {
  execution_id: string
  proposal_hash: string
  status: ConnectorReconciliationEvidence["status"]
  provider_operation: string | null
  provider_reference: string | null
  observed_state: string | null
  evidence: Record<string, unknown>
  evidence_hash: string
  adapter_id: string
  adapter_version: number
  checked_at: string
}

/** Server-only reconciliation evidence store. Provider evidence is never accepted from the browser. */
export class SupabaseConnectorReconciliationStore implements ConnectorReconciliationStore {
  constructor(private readonly supabase = createServiceRoleClient()) {}

  async get(executionId: string): Promise<ConnectorReconciliationEvidence | undefined> {
    if (!this.supabase) throw new Error("Supabase service-role client is not configured")
    const { data, error } = await this.supabase
      .from("jhadina_connector_execution_reconciliation")
      .select("execution_id, proposal_hash, status, provider_operation, provider_reference, observed_state, evidence, evidence_hash, adapter_id, adapter_version, checked_at")
      .eq("execution_id", executionId)
      .order("checked_at", { ascending: false })
      .limit(1)
      .maybeSingle<Row>()
    if (error) throw new Error(`Failed to read reconciliation evidence: ${error.message}`)
    return data ? mapRow(data) : undefined
  }

  async record(evidence: ConnectorReconciliationEvidence): Promise<boolean> {
    if (!this.supabase) throw new Error("Supabase service-role client is not configured")

    const { data: execution, error: executionError } = await this.supabase
      .from("jhadina_connector_execution_ledger")
      .select("proposal_hash")
      .eq("execution_id", evidence.executionId)
      .maybeSingle<{ proposal_hash: string }>()
    if (executionError) throw new Error(`Failed to verify execution for reconciliation: ${executionError.message}`)
    if (!execution) throw new Error(`Connector execution not found: ${evidence.executionId}`)
    if (execution.proposal_hash !== evidence.proposalHash) throw new Error("Reconciliation proposal hash does not match execution")

    const { error } = await this.supabase
      .from("jhadina_connector_execution_reconciliation")
      .insert({
        execution_id: evidence.executionId,
        proposal_hash: evidence.proposalHash,
        status: evidence.status,
        provider_operation: evidence.operation,
        provider_reference: evidence.providerReference ?? null,
        observed_state: evidence.providerState ?? null,
        evidence: {
          idempotencyKey: evidence.idempotencyKey,
          connectorId: evidence.connectorId,
          operation: evidence.operation,
          source: evidence.source,
          observedAt: evidence.observedAt,
        },
        evidence_hash: evidence.evidenceHash,
        adapter_id: evidence.source,
        adapter_version: evidence.adapterVersion,
        checked_at: evidence.checkedAt,
      })
    if (!error) return true
    if (error.code === "23505") return false
    throw new Error(`Failed to persist reconciliation evidence: ${error.message}`)
  }
}

function mapRow(row: Row): ConnectorReconciliationEvidence {
  const evidence = row.evidence ?? {}
  const idempotencyKey = typeof evidence.idempotencyKey === "string" ? evidence.idempotencyKey : ""
  const connectorId = typeof evidence.connectorId === "string" ? evidence.connectorId : ""
  const operation = typeof evidence.operation === "string" ? evidence.operation : row.provider_operation ?? ""
  const source = typeof evidence.source === "string" ? evidence.source : row.adapter_id
  const observedAt = typeof evidence.observedAt === "string" ? evidence.observedAt : row.checked_at
  return {
    executionId: row.execution_id,
    proposalHash: row.proposal_hash,
    idempotencyKey,
    connectorId,
    operation,
    status: row.status,
    ...(row.provider_reference ? { providerReference: row.provider_reference } : {}),
    ...(row.observed_state ? { providerState: row.observed_state } : {}),
    observedAt,
    checkedAt: row.checked_at,
    adapterVersion: row.adapter_version,
    source,
    evidenceHash: row.evidence_hash,
  }
}
