import "server-only"
import { createServiceRoleClient } from "../supabase/service-role"

export type RecoveryEvidence = {
  executionId:string
  approvalId:string|null
  proposalId:string|null
  proposalHash:string
  connectorId:string
  operation:string
  state:string
  recoveryOfExecutionId:string|null
  startedAt:string
  completedAt:string|null
  updatedAt:string
  reconciliation:Array<{
    reconciliationId:string
    status:string
    observedState:string|null
    evidenceHash:string
    adapterId:string
    adapterVersion:number
    checkedAt:string
  }>
}

/**
 * Privileged server-only read projected down to one verified actor.
 * Never return provider response/error/evidence payloads or lease internals.
 */
export async function listRecoveryEvidence(actorId:string):Promise<RecoveryEvidence[]>{
  const supabase=createServiceRoleClient()
  if(!supabase)return []
  const {data:executions,error}=await supabase.from("jhadina_connector_execution_ledger")
    .select("execution_id,approval_id,proposal_id,proposal_hash,connector_id,operation,state,recovery_of_execution_id,started_at,completed_at,updated_at")
    .eq("actor_id",actorId).order("updated_at",{ascending:false})
  if(error)throw new Error("Unable to read connector execution evidence")
  const ids=(executions??[]).map(row=>row.execution_id)
  if(ids.length===0)return []
  const {data:reconciliations,error:reconciliationError}=await supabase.from("jhadina_connector_execution_reconciliation")
    .select("reconciliation_id,execution_id,status,observed_state,evidence_hash,adapter_id,adapter_version,checked_at")
    .in("execution_id",ids).order("checked_at",{ascending:false})
  if(reconciliationError)throw new Error("Unable to read connector reconciliation evidence")
  return (executions??[]).map(row=>({
    executionId:row.execution_id,approvalId:row.approval_id,proposalId:row.proposal_id,proposalHash:row.proposal_hash,
    connectorId:row.connector_id,operation:row.operation,state:row.state,recoveryOfExecutionId:row.recovery_of_execution_id,
    startedAt:row.started_at,completedAt:row.completed_at,updatedAt:row.updated_at,
    reconciliation:(reconciliations??[]).filter(item=>item.execution_id===row.execution_id).map(item=>({
      reconciliationId:item.reconciliation_id,status:item.status,observedState:item.observed_state,evidenceHash:item.evidence_hash,
      adapterId:item.adapter_id,adapterVersion:item.adapter_version,checkedAt:item.checked_at
    }))
  }))
}
