import type { JhadinaActivityEvent } from "./activity"
import { listJhadinaActivity } from "./activity"

export type ApprovalLifecycleState =
  | "requested"
  | "executing"
  | "completed"
  | "denied"
  | "failed"

export type ApprovalLifecycleEvidence = {
  source: "action_audit"
  eventId: string
  status: JhadinaActivityEvent["status"]
  timestamp: string
}

export type ApprovalLifecycleProjection = {
  actionId: string
  actorId: string
  domain: string
  capability: string
  state: ApprovalLifecycleState
  updatedAt: string
  metadata?: Record<string, unknown>
  evidence: ApprovalLifecycleEvidence[]
}

function stateFor(status:JhadinaActivityEvent["status"]):ApprovalLifecycleState {
  if(status==="approval_required") return "requested"
  if(status==="started") return "executing"
  return status
}

/**
 * Evidence-backed approval lifecycle projection.
 *
 * This intentionally does not synthesize approved/verifying/reconciled/
 * recovered. Those states require proposal/receipt/execution/reconciliation
 * evidence that ActionAudit alone cannot prove.
 */
export function projectApprovalLifecycle(events:JhadinaActivityEvent[]):ApprovalLifecycleProjection[]{
  const groups=new Map<string,JhadinaActivityEvent[]>()
  for(const event of events){
    const key=event.domain+":"+event.actionId
    const group=groups.get(key)??[]
    group.push(event)
    groups.set(key,group)
  }
  return [...groups.values()].map(group=>{
    const sorted=[...group].sort((a,b)=>b.timestamp.localeCompare(a.timestamp))
    const latest=sorted[0]
    return {
      actionId:latest.actionId,
      actorId:latest.userId,
      domain:latest.domain,
      capability:latest.type,
      state:stateFor(latest.status),
      updatedAt:latest.timestamp,
      metadata:latest.metadata,
      evidence:sorted.map(event=>({source:"action_audit" as const,eventId:event.id,status:event.status,timestamp:event.timestamp}))
    }
  }).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))
}

export async function listApprovalLifecycle(actorId:string):Promise<ApprovalLifecycleProjection[]>{
  return projectApprovalLifecycle(await listJhadinaActivity(actorId))
}
