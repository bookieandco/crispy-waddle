import {buildWorkSessionRuntimeProjection,type WorkSessionRuntimeProjection} from './work-session-projection.js';
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
  attention:WorkSessionRuntimeProjection;
  updatedAt?:string;
}

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

  const updatedAt=tasks.length
    ?[...tasks].map(task=>task.updatedAt).sort((a,b)=>b.localeCompare(a))[0]
    :undefined;
  const attention=buildWorkSessionRuntimeProjection(
    tasks,
    updatedAt??'1970-01-01T00:00:00.000Z',
  );
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

  return Object.freeze({
    workSessionId,
    totalTasks:tasks.length,
    automaticInFlightCount:tasks.filter(task=>AUTOMATIC.has(task.status)).length,
    humanAttentionCount:attention.humanAttention.length,
    terminalCount:tasks.filter(task=>TERMINAL.has(task.status)).length,
    countsByStatus:attention.countsByStatus,
    countsByDomain:Object.freeze(Object.fromEntries(Object.entries(attention.countsByDomain).sort(([a],[b])=>a.localeCompare(b)))),
    recent:Object.freeze(recent),
    attention,
    updatedAt,
  });
}
