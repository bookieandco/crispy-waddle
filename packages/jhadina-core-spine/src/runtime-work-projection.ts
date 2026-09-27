import {buildRuntimeAttentionProjection,type RuntimeAttentionProjection} from './runtime-attention.js';
import type {WorkSessionTask,WorkSessionTaskStatus} from './work-session.js';

export interface RuntimeTaskSummary {
  id:string;
  domain:string;
  capability:string;
  status:WorkSessionTaskStatus;
  attempt:number;
  maxAttempts:number;
  updatedAt:string;
}

export interface RuntimeWorkProjection {
  workSessionId:string;
  totalTasks:number;
  automaticInFlightCount:number;
  humanAttentionCount:number;
  terminalCount:number;
  countsByStatus:Readonly<Record<WorkSessionTaskStatus,number>>;
  countsByDomain:Readonly<Record<string,number>>;
  recent:readonly RuntimeTaskSummary[];
  attention:RuntimeAttentionProjection;
  updatedAt?:string;
}

const STATUSES:readonly WorkSessionTaskStatus[]=[
  'queued','waiting-dependency','ready','running','waiting-approval','retrying',
  'paused','blocked','completed','failed','cancelled',
];

const AUTOMATIC=new Set<WorkSessionTaskStatus>(['queued','waiting-dependency','ready','running','retrying']);
const TERMINAL=new Set<WorkSessionTaskStatus>(['completed','failed','cancelled']);

export function buildRuntimeWorkProjection(
  workSessionId:string,
  tasks:readonly WorkSessionTask[],
  recentLimit=12,
):RuntimeWorkProjection{
  if(!workSessionId.trim())throw new Error('RUNTIME_PROJECTION_WORK_SESSION_REQUIRED');
  if(!Number.isInteger(recentLimit)||recentLimit<0||recentLimit>100)throw new Error('RUNTIME_PROJECTION_RECENT_LIMIT_INVALID');
  if(tasks.some(task=>task.workSessionId!==workSessionId))throw new Error('RUNTIME_PROJECTION_SCOPE_MISMATCH');

  const countsByStatus=Object.fromEntries(STATUSES.map(status=>[status,0])) as Record<WorkSessionTaskStatus,number>;
  const countsByDomain:Record<string,number>={};
  for(const task of tasks){
    countsByStatus[task.status]+=1;
    countsByDomain[task.domain]=(countsByDomain[task.domain]??0)+1;
  }

  const attention=buildRuntimeAttentionProjection(tasks);
  const recent=recentLimit===0?[]:[...tasks]
    .sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id))
    .slice(0,recentLimit)
    .map((task):RuntimeTaskSummary=>Object.freeze({
      id:task.id,
      domain:task.domain,
      capability:task.capability,
      status:task.status,
      attempt:task.attempt,
      maxAttempts:task.maxAttempts,
      updatedAt:task.updatedAt,
    }));

  const updatedAt=tasks.length
    ?[...tasks].map(task=>task.updatedAt).sort((a,b)=>b.localeCompare(a))[0]
    :undefined;

  return Object.freeze({
    workSessionId,
    totalTasks:tasks.length,
    automaticInFlightCount:tasks.filter(task=>AUTOMATIC.has(task.status)).length,
    humanAttentionCount:attention.items.length,
    terminalCount:tasks.filter(task=>TERMINAL.has(task.status)).length,
    countsByStatus:Object.freeze({...countsByStatus}),
    countsByDomain:Object.freeze(Object.fromEntries(Object.entries(countsByDomain).sort(([a],[b])=>a.localeCompare(b)))),
    recent:Object.freeze(recent),
    attention,
    updatedAt,
  });
}
