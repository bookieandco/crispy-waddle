export type WorkSessionStatus='active'|'waiting-approval'|'completed'|'abandoned';

export interface WorkSessionArtifactRef {
  id:string;
  kind:'screen'|'image'|'audio'|'video'|'document'|'code'|'data';
  provenanceRef:string;
  admitted:boolean;
}

export interface JhadinaWorkSession {
  id:string;
  ownerUserId:string;
  createdAt:string;
  updatedAt:string;
  status:WorkSessionStatus;
  goal:string;
  activeSubsystems:readonly string[];
  artifactRefs:readonly WorkSessionArtifactRef[];
  decisionRefs:readonly string[];
  outputRefs:readonly string[];
}

export interface WorkSessionRepository {
  get(id:string):Promise<JhadinaWorkSession|null>;
  save(session:JhadinaWorkSession):Promise<void>;
}

export type WorkSessionTaskStatus =
  |'queued'
  |'waiting-dependency'
  |'ready'
  |'running'
  |'waiting-approval'
  |'retrying'
  |'paused'
  |'blocked'
  |'completed'
  |'failed'
  |'cancelled';

export interface WorkSessionTask {
  id:string;
  workSessionId:string;
  ownerUserId:string;
  parentTaskId?:string;
  domain:string;
  capability:string;
  status:WorkSessionTaskStatus;
  /** Traceability only. This reference never grants execution authority. */
  authorityRef:string;
  idempotencyKey:string;
  correlationId:string;
  causationId?:string;
  dependencyIds:readonly string[];
  inputRefs:readonly string[];
  outputRefs:readonly string[];
  blockedReason?:string;
  attempt:number;
  maxAttempts:number;
  version:number;
  createdAt:string;
  updatedAt:string;
}

export interface WorkSessionTaskRepository {
  get(workSessionId:string,taskId:string):Promise<WorkSessionTask|null>;
  list(workSessionId:string):Promise<readonly WorkSessionTask[]>;
  create(task:WorkSessionTask):Promise<void>;
  /**
   * Implementations must compare-and-swap on version and reject stale writes.
   * The task returned by evolveWorkSessionTask already increments version.
   */
  update(task:WorkSessionTask,expectedVersion:number):Promise<void>;
}

const TASK_TRANSITIONS:Readonly<Record<WorkSessionTaskStatus,readonly WorkSessionTaskStatus[]>>=Object.freeze({
  'queued':['waiting-dependency','ready','blocked','cancelled'],
  'waiting-dependency':['ready','blocked','cancelled'],
  'ready':['running','waiting-approval','blocked','cancelled'],
  'running':['waiting-approval','retrying','paused','blocked','completed','failed','cancelled'],
  'waiting-approval':['ready','running','blocked','completed','cancelled'],
  'retrying':['ready','running','blocked','failed','cancelled'],
  'paused':['ready','running','blocked','cancelled'],
  'blocked':['ready','cancelled'],
  'completed':[],
  'failed':['retrying','cancelled'],
  'cancelled':[],
});

export function createWorkSession(input:{id:string;ownerUserId:string;goal:string;createdAt?:string}):JhadinaWorkSession{
  const at=input.createdAt??new Date().toISOString();
  if(!input.id.trim()||!input.ownerUserId.trim()||!input.goal.trim())throw new Error('WORK_SESSION_REQUIRED_FIELDS');
  return Object.freeze({id:input.id,ownerUserId:input.ownerUserId,goal:input.goal,createdAt:at,updatedAt:at,status:'active',activeSubsystems:Object.freeze([]),artifactRefs:Object.freeze([]),decisionRefs:Object.freeze([]),outputRefs:Object.freeze([])});
}

export function evolveWorkSession(session:JhadinaWorkSession,patch:{status?:WorkSessionStatus;activeSubsystems?:readonly string[];artifactRefs?:readonly WorkSessionArtifactRef[];decisionRefs?:readonly string[];outputRefs?:readonly string[];updatedAt?:string}):JhadinaWorkSession{
  return Object.freeze({...session,...patch,updatedAt:patch.updatedAt??new Date().toISOString(),
    activeSubsystems:Object.freeze([...(patch.activeSubsystems??session.activeSubsystems)]),
    artifactRefs:Object.freeze([...(patch.artifactRefs??session.artifactRefs)]),
    decisionRefs:Object.freeze([...(patch.decisionRefs??session.decisionRefs)]),
    outputRefs:Object.freeze([...(patch.outputRefs??session.outputRefs)]),
  });
}

export function createWorkSessionTask(input:{
  id:string;
  workSessionId:string;
  ownerUserId:string;
  parentTaskId?:string;
  domain:string;
  capability:string;
  authorityRef:string;
  idempotencyKey:string;
  correlationId:string;
  causationId?:string;
  dependencyIds?:readonly string[];
  inputRefs?:readonly string[];
  maxAttempts?:number;
  createdAt?:string;
}):WorkSessionTask{
  const at=input.createdAt??new Date().toISOString();
  const required=[input.id,input.workSessionId,input.ownerUserId,input.domain,input.capability,input.authorityRef,input.idempotencyKey,input.correlationId];
  if(required.some(value=>!value.trim()))throw new Error('WORK_SESSION_TASK_REQUIRED_FIELDS');
  const maxAttempts=input.maxAttempts??3;
  if(!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>20)throw new Error('WORK_SESSION_TASK_MAX_ATTEMPTS_INVALID');
  const dependencies=uniqueStrings(input.dependencyIds??[]);
  if(dependencies.includes(input.id))throw new Error('WORK_SESSION_TASK_SELF_DEPENDENCY');
  return freezeTask({
    id:input.id,workSessionId:input.workSessionId,ownerUserId:input.ownerUserId,parentTaskId:input.parentTaskId,
    domain:input.domain,capability:input.capability,status:dependencies.length?'waiting-dependency':'queued',
    authorityRef:input.authorityRef,idempotencyKey:input.idempotencyKey,correlationId:input.correlationId,causationId:input.causationId,
    dependencyIds:dependencies,inputRefs:uniqueStrings(input.inputRefs??[]),outputRefs:[],attempt:0,maxAttempts,version:1,
    createdAt:at,updatedAt:at,
  });
}

export function evolveWorkSessionTask(
  task:WorkSessionTask,
  patch:{
    status?:WorkSessionTaskStatus;
    outputRefs?:readonly string[];
    blockedReason?:string;
    attempt?:number;
    updatedAt?:string;
  },
):WorkSessionTask{
  if(patch.status&&patch.status!==task.status){
    const allowed=TASK_TRANSITIONS[task.status];
    if(!allowed.includes(patch.status))throw new Error(`WORK_SESSION_TASK_TRANSITION_INVALID:${task.status}->${patch.status}`);
  }
  const attempt=patch.attempt??task.attempt;
  if(!Number.isInteger(attempt)||attempt<0||attempt>task.maxAttempts)throw new Error('WORK_SESSION_TASK_ATTEMPT_INVALID');
  const status=patch.status??task.status;
  const blockedReason=patch.blockedReason??task.blockedReason;
  if(status==='blocked'&&!blockedReason?.trim())throw new Error('WORK_SESSION_TASK_BLOCK_REASON_REQUIRED');
  return freezeTask({
    ...task,
    ...patch,
    status,
    attempt,
    blockedReason:status==='blocked'?blockedReason:undefined,
    outputRefs:uniqueStrings(patch.outputRefs??task.outputRefs),
    version:task.version+1,
    updatedAt:patch.updatedAt??new Date().toISOString(),
  });
}

export function validateWorkSessionTaskGraph(tasks:readonly WorkSessionTask[]):void{
  const byId=new Map<string,WorkSessionTask>();
  for(const task of tasks){
    if(byId.has(task.id))throw new Error(`WORK_SESSION_TASK_DUPLICATE:${task.id}`);
    byId.set(task.id,task);
  }
  for(const task of tasks){
    for(const dependencyId of task.dependencyIds){
      const dependency=byId.get(dependencyId);
      if(!dependency)throw new Error(`WORK_SESSION_TASK_DEPENDENCY_MISSING:${dependencyId}`);
      if(dependency.workSessionId!==task.workSessionId||dependency.ownerUserId!==task.ownerUserId)throw new Error('WORK_SESSION_TASK_DEPENDENCY_SCOPE_MISMATCH');
    }
    if(task.parentTaskId){
      const parent=byId.get(task.parentTaskId);
      if(!parent)throw new Error(`WORK_SESSION_TASK_PARENT_MISSING:${task.parentTaskId}`);
      if(parent.workSessionId!==task.workSessionId||parent.ownerUserId!==task.ownerUserId)throw new Error('WORK_SESSION_TASK_PARENT_SCOPE_MISMATCH');
    }
  }
  const visiting=new Set<string>(),visited=new Set<string>();
  const visit=(id:string)=>{
    if(visited.has(id))return;
    if(visiting.has(id))throw new Error(`WORK_SESSION_TASK_CYCLE:${id}`);
    visiting.add(id);
    for(const dep of byId.get(id)?.dependencyIds??[])visit(dep);
    visiting.delete(id);
    visited.add(id);
  };
  for(const task of tasks)visit(task.id);
}

export function listReadyWorkSessionTasks(tasks:readonly WorkSessionTask[]):readonly WorkSessionTask[]{
  validateWorkSessionTaskGraph(tasks);
  const byId=new Map(tasks.map(task=>[task.id,task] as const));
  return Object.freeze(tasks.filter(task=>
    (task.status==='queued'||task.status==='waiting-dependency')&&
    task.dependencyIds.every(id=>byId.get(id)?.status==='completed')
  ));
}

function uniqueStrings(values:readonly string[]):readonly string[]{
  return Object.freeze([...new Set(values.map(value=>value.trim()).filter(Boolean))]);
}

function freezeTask(task:WorkSessionTask):WorkSessionTask{
  return Object.freeze({
    ...task,
    dependencyIds:Object.freeze([...task.dependencyIds]),
    inputRefs:Object.freeze([...task.inputRefs]),
    outputRefs:Object.freeze([...task.outputRefs]),
  });
}
