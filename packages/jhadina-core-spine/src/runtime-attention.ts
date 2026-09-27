import type {WorkSessionTask} from './work-session.js';

export type RuntimeAttentionSeverity='medium'|'high'|'critical';
export type RuntimeAttentionKind='approval'|'blocked'|'failed'|'paused';
export type RuntimeAttentionAction='APPROVE_OR_REJECT'|'RESOLVE_BLOCKER'|'REVIEW_FAILURE'|'RESUME_OR_CANCEL';

export interface RuntimeAttentionItem {
  id:string;
  workSessionId:string;
  taskId:string;
  domain:string;
  capability:string;
  kind:RuntimeAttentionKind;
  severity:RuntimeAttentionSeverity;
  reason:string;
  action:RuntimeAttentionAction;
  updatedAt:string;
}

export interface RuntimeAttentionProjection {
  items:readonly RuntimeAttentionItem[];
  approvalCount:number;
  blockerCount:number;
  failureCount:number;
  pausedCount:number;
  needsHuman:boolean;
}

export function buildRuntimeAttentionProjection(tasks:readonly WorkSessionTask[]):RuntimeAttentionProjection{
  const items:RuntimeAttentionItem[]=[];
  for(const task of tasks){
    if(task.status==='waiting-approval'){
      items.push(item(task,'approval','high','Approval is required before this task can continue.','APPROVE_OR_REJECT'));
    }else if(task.status==='blocked'){
      items.push(item(task,'blocked','high',task.blockedReason?.trim()||'Task is blocked.','RESOLVE_BLOCKER'));
    }else if(task.status==='failed'){
      const exhausted=task.attempt>=task.maxAttempts;
      items.push(item(task,'failed',exhausted?'critical':'high',exhausted?'Task exhausted its retry budget.':'Task failed and requires review.','REVIEW_FAILURE'));
    }else if(task.status==='paused'){
      items.push(item(task,'paused','medium','Task is paused.','RESUME_OR_CANCEL'));
    }
  }

  const rank:Record<RuntimeAttentionSeverity,number>={critical:0,high:1,medium:2};
  items.sort((a,b)=>rank[a.severity]-rank[b.severity]||b.updatedAt.localeCompare(a.updatedAt)||a.taskId.localeCompare(b.taskId));
  const frozen=Object.freeze(items.map(value=>Object.freeze({...value})));
  return Object.freeze({
    items:frozen,
    approvalCount:frozen.filter(value=>value.kind==='approval').length,
    blockerCount:frozen.filter(value=>value.kind==='blocked').length,
    failureCount:frozen.filter(value=>value.kind==='failed').length,
    pausedCount:frozen.filter(value=>value.kind==='paused').length,
    needsHuman:frozen.length>0,
  });
}

function item(
  task:WorkSessionTask,
  kind:RuntimeAttentionKind,
  severity:RuntimeAttentionSeverity,
  reason:string,
  action:RuntimeAttentionAction,
):RuntimeAttentionItem{
  return Object.freeze({
    id:`attention:${task.workSessionId}:${task.id}:${task.version}`,
    workSessionId:task.workSessionId,
    taskId:task.id,
    domain:task.domain,
    capability:task.capability,
    kind,
    severity,
    reason,
    action,
    updatedAt:task.updatedAt,
  });
}
