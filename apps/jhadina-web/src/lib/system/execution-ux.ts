export type JhadinaExecutionState =
  | "proposed"
  | "needs_approval"
  | "approved"
  | "executing"
  | "verifying"
  | "completed"
  | "denied"
  | "failed"
  | "recovery_required"
  | "reconciled"
  | "retry_safe"
  | "recovered"

export function executionStateLabel(state:JhadinaExecutionState):string{
  if(state==="needs_approval")return "Needs approval"
  if(state==="recovery_required")return "Recovery required"
  if(state==="retry_safe")return "Retry safe · fresh authorization required"
  return state.replaceAll("_"," ").replace(/\b\w/g,letter=>letter.toUpperCase())
}

export function auditExecutionState(status:"started"|"approval_required"|"completed"|"denied"|"failed"):JhadinaExecutionState{
  if(status==="approval_required")return "needs_approval"
  if(status==="started")return "executing"
  return status
}

export function connectorExecutionState(input:{
  state:string
  recoveryOfExecutionId?:string|null
  reconciliation?:{status?:string|null;observedState?:string|null}|null
}):JhadinaExecutionState{
  const raw=input.state.toLowerCase()
  const reconciliation=input.reconciliation?.status?.toLowerCase()
  if(input.recoveryOfExecutionId && ["completed","succeeded","success"].includes(raw))return "recovered"
  if(reconciliation==="confirmed_not_executed")return "retry_safe"
  if(reconciliation==="confirmed_executed")return "reconciled"
  if(reconciliation==="unknown")return "recovery_required"
  if(raw==="recovery_required"||raw==="unknown")return "recovery_required"
  if(["completed","succeeded","success"].includes(raw))return "completed"
  if(raw==="failed")return "failed"
  if(raw==="denied")return "denied"
  if(raw==="approved")return "approved"
  if(raw==="verifying")return "verifying"
  return "executing"
}

export function executionStateTone(state:JhadinaExecutionState):"success"|"warning"|"danger"|"neutral"{
  if(["completed","recovered"].includes(state))return "success"
  if(["needs_approval","recovery_required","reconciled","retry_safe","verifying"].includes(state))return "warning"
  if(["failed","denied"].includes(state))return "danger"
  return "neutral"
}
