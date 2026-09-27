import {
  validateWorkSessionTaskGraph,
  type WorkSessionTask,
  type WorkSessionTaskStatus,
} from './work-session.js';

export type RuntimeAttentionKind =
  | 'approval'
  | 'blocked'
  | 'retry-exhausted'
  | 'lease-recovery'
  | 'automatic-retry'
  | 'paused';

export interface RuntimeAttentionItem {
  taskId:string;
  domain:string;
  capability:string;
  status:WorkSessionTaskStatus;
  kind:RuntimeAttentionKind;
  requiresHuman:boolean;
  reason?:string;
}

export interface WorkSessionRuntimeProjection {
  workSessionId:string;
  totalTasks:number;
  activeTasks:number;
  completedTasks:number;
  countsByStatus:Readonly<Record<WorkSessionTaskStatus,number>>;
  countsByDomain:Readonly<Record<string,number>>;
  humanAttention:readonly RuntimeAttentionItem[];
  systemAttention:readonly RuntimeAttentionItem[];
}

/**
 * Presentation-only projection for Ask Jhadina / Command Center.
 * It cannot claim tasks, change capability health or authorize actions.
 */
export function buildWorkSessionRuntimeProjection(
  tasks:readonly WorkSessionTask[],
  nowIso:string,
):WorkSessionRuntimeProjection {
  validateWorkSessionTaskGraph(tasks);
  const now=Date.parse(nowIso);
  if(!Number.isFinite(now))throw new Error('WORK_SESSION_RUNTIME_NOW_INVALID');
  const workSessionIds=[...new Set(tasks.map(task=>task.workSessionId))];
  if(workSessionIds.length>1)throw new Error('WORK_SESSION_RUNTIME_SCOPE_MISMATCH');

  const countsByStatus=emptyStatusCounts();
  const countsByDomain:Record<string,number>={};
  const human:RuntimeAttentionItem[]=[];
  const system:RuntimeAttentionItem[]=[];

  for(const task of tasks){
    countsByStatus[task.status]+=1;
    countsByDomain[task.domain]=(countsByDomain[task.domain]??0)+1;

    if(task.status==='waiting-approval'){
      human.push(item(task,'approval',true,'explicit approval required'));
      continue;
    }
    if(task.status==='blocked'){
      human.push(item(task,'blocked',true,task.blockedReason??'task blocked'));
      continue;
    }
    if(task.status==='paused'){
      human.push(item(task,'paused',true,'task paused; resume or cancel decision required'));
      continue;
    }
    if(task.status==='failed'){
      if(task.attempt>=task.maxAttempts){
        human.push(item(task,'retry-exhausted',true,'retry budget exhausted'));
      }else{
        system.push(item(task,'automatic-retry',false,'retry budget remains'));
      }
      continue;
    }
    if(
      task.status==='running'&&
      task.leaseExpiresAt&&
      Date.parse(task.leaseExpiresAt)<=now
    ){
      if(task.attempt>=task.maxAttempts){
        human.push(item(task,'retry-exhausted',true,'worker lease expired and retry budget exhausted'));
      }else{
        system.push(item(task,'lease-recovery',false,'worker lease expired; task is reclaimable'));
      }
    }
  }

  const terminal=new Set<WorkSessionTaskStatus>(['completed','failed','cancelled']);
  const completed=countsByStatus.completed;
  const active=tasks.filter(task=>!terminal.has(task.status)).length;

  return Object.freeze({
    workSessionId:workSessionIds[0]??'',
    totalTasks:tasks.length,
    activeTasks:active,
    completedTasks:completed,
    countsByStatus:Object.freeze({...countsByStatus}),
    countsByDomain:Object.freeze({...countsByDomain}),
    humanAttention:Object.freeze(sortAttention(human)),
    systemAttention:Object.freeze(sortAttention(system)),
  });
}

function item(
  task:WorkSessionTask,
  kind:RuntimeAttentionKind,
  requiresHuman:boolean,
  reason?:string,
):RuntimeAttentionItem {
  return Object.freeze({
    taskId:task.id,
    domain:task.domain,
    capability:task.capability,
    status:task.status,
    kind,
    requiresHuman,
    reason,
  });
}

function sortAttention(items:RuntimeAttentionItem[]):RuntimeAttentionItem[]{
  return items.sort((a,b)=>a.domain.localeCompare(b.domain)||a.taskId.localeCompare(b.taskId));
}

function emptyStatusCounts():Record<WorkSessionTaskStatus,number>{
  return {
    queued:0,
    'waiting-dependency':0,
    ready:0,
    running:0,
    'waiting-approval':0,
    retrying:0,
    paused:0,
    blocked:0,
    completed:0,
    failed:0,
    cancelled:0,
  };
}
