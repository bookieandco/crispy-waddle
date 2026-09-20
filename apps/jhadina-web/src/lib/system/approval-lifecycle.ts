import type { JhadinaActivityEvent } from "./activity"
import { listJhadinaActivity } from "./activity"
import { listRecoveryEvidence,type RecoveryEvidence } from "./recovery-evidence"

export type ApprovalLifecycleState="requested"|"executing"|"completed"|"denied"|"failed"|"recovery_required"|"reconciled"|"recovered"
export type ApprovalLifecycleEvidence=
 | {source:"action_audit";eventId:string;status:JhadinaActivityEvent["status"];timestamp:string}
 | {source:"connector_execution";executionId:string;status:string;timestamp:string;proposalHash:string}
 | {source:"connector_reconciliation";reconciliationId:string;status:string;timestamp:string;evidenceHash:string}

export type ApprovalLifecycleProjection={actionId:string;actorId:string;domain:string;capability:string;state:ApprovalLifecycleState;updatedAt:string;metadata?:Record<string,unknown>;evidence:ApprovalLifecycleEvidence[]}

function stateFor(status:JhadinaActivityEvent["status"]):ApprovalLifecycleState{if(status==="approval_required")return"requested";if(status==="started")return"executing";return status}
function recoveryState(execution:RecoveryEvidence):ApprovalLifecycleState{
 if(execution.recoveryOfExecutionId&&execution.state==="completed")return"recovered"
 if(execution.reconciliation.length>0)return"reconciled"
 if(execution.state==="recovery_required")return"recovery_required"
 if(execution.state==="completed")return"completed"
 if(execution.state==="failed")return"failed"
 return"executing"
}

export function projectApprovalLifecycle(events:JhadinaActivityEvent[],recovery:RecoveryEvidence[]=[]):ApprovalLifecycleProjection[]{
 const groups=new Map<string,JhadinaActivityEvent[]>()
 for(const event of events){const key=event.domain+":"+event.actionId;const group=groups.get(key)??[];group.push(event);groups.set(key,group)}
 const projected=[...groups.values()].map(group=>{const sorted=[...group].sort((a,b)=>b.timestamp.localeCompare(a.timestamp));const latest=sorted[0];return{actionId:latest.actionId,actorId:latest.userId,domain:latest.domain,capability:latest.type,state:stateFor(latest.status),updatedAt:latest.timestamp,metadata:latest.metadata,evidence:sorted.map(event=>({source:"action_audit" as const,eventId:event.id,status:event.status,timestamp:event.timestamp}))} satisfies ApprovalLifecycleProjection})
 for(const execution of recovery){
   const match=projected.find(item=>item.actionId===execution.proposalId||item.actionId===execution.approvalId)
   if(!match)continue
   const rec=execution.reconciliation[0]
   match.evidence.push({source:"connector_execution",executionId:execution.executionId,status:execution.state,timestamp:execution.updatedAt,proposalHash:execution.proposalHash})
   if(rec)match.evidence.push({source:"connector_reconciliation",reconciliationId:rec.reconciliationId,status:rec.status,timestamp:rec.checkedAt,evidenceHash:rec.evidenceHash})
   if(execution.updatedAt>=match.updatedAt){match.state=recoveryState(execution);match.updatedAt=execution.updatedAt}
 }
 return projected.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))
}

export async function listApprovalLifecycle(actorId:string):Promise<ApprovalLifecycleProjection[]>{
 const [activity,recovery]=await Promise.all([listJhadinaActivity(actorId),listRecoveryEvidence(actorId)])
 return projectApprovalLifecycle(activity,recovery)
}
