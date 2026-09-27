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
  /** Worker lease fields are concurrency controls only; they never grant action authority. */
  leaseOwner?:string;
  leaseToken?:string;
  leaseExpiresAt?:string;
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

export interface LeaseableWorkSessionTaskRepository extends WorkSessionTaskRepository {
  claimReady(workSessionId:string,taskId:string,workerId:string,leaseMs:number):Promise<WorkSessionTask|null>;
  renewLease(workSessionId:string,taskId:string,workerId:string,leaseToken:string,leaseMs:number):Promise<WorkSessionTask|null>;
  releaseLease(workSessionId:string,taskId:string,workerId:string,leaseToken:string,nextStatus:WorkSessionTaskStatus,blockedReason?:string):Promise<WorkSessionTask|null>;
}


export class InMemoryWorkSessionTaskRepository implements LeaseableWorkSessionTaskRepository {
  private readonly tasks=new Map<string,WorkSessionTask>();
  private readonly idempotency=new Map<string,string>();

  async get(workSessionId:string,taskId:string):Promise<WorkSessionTask|null>{
    return this.tasks.get(key(workSessionId,taskId))??null;
  }

  async list(workSessionId:string):Promise<readonly WorkSessionTask[]>{
    return Object.freeze([...this.tasks.values()].filter(task=>task.workSessionId===workSessionId).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)));
  }

  async create(task:WorkSessionTask):Promise<void>{
    const taskKey=key(task.workSessionId,task.id);
    if(this.tasks.has(taskKey))throw new Error('WORK_SESSION_TASK_ALREADY_EXISTS');
    const idemKey=idempotencyKey(task);
    if(this.idempotency.has(idemKey))throw new Error('WORK_SESSION_TASK_IDEMPOTENCY_CONFLICT');
    const existing=await this.list(task.workSessionId);
    validateWorkSessionTaskGraph([...existing,task]);
    this.tasks.set(taskKey,freezeTask(task));
    this.idempotency.set(idemKey,task.id);
  }

  async update(task:WorkSessionTask,expectedVersion:number):Promise<void>{
    const taskKey=key(task.workSessionId,task.id);
    const current=this.tasks.get(taskKey);
    if(!current)throw new Error('WORK_SESSION_TASK_NOT_FOUND');
    if(current.ownerUserId!==task.ownerUserId)throw new Error('WORK_SESSION_TASK_OWNER_MISMATCH');
    if(current.version!==expectedVersion||task.version!==expectedVersion+1)throw new Error('WORK_SESSION_TASK_VERSION_CONFLICT');
    if(current.idempotencyKey!==task.idempotencyKey||current.workSessionId!==task.workSessionId)throw new Error('WORK_SESSION_TASK_IMMUTABLE_IDENTITY');
    const all=(await this.list(task.workSessionId)).map(candidate=>candidate.id===task.id?task:candidate);
    validateWorkSessionTaskGraph(all);
    this.tasks.set(taskKey,freezeTask(task));
  }

  async claimReady(workSessionId:string,taskId:string,workerId:string,leaseMs:number):Promise<WorkSessionTask|null>{
    if(!workerId.trim()||!Number.isFinite(leaseMs)||leaseMs<1)throw new Error('WORK_SESSION_TASK_LEASE_INVALID');
    const taskKey=key(workSessionId,taskId);
    const current=this.tasks.get(taskKey);
    if(!current)return null;
    const now=Date.now();
    const expiredRunning=current.status==='running'&&!!current.leaseExpiresAt&&Date.parse(current.leaseExpiresAt)<=now;
    if(current.status!=='ready'&&current.status!=='retrying'&&!expiredRunning)return null;
    if(current.attempt>=current.maxAttempts)return null;
    if(current.leaseExpiresAt&&Date.parse(current.leaseExpiresAt)>now&&current.leaseOwner!==workerId)return null;
    const claimed=freezeTask({
      ...current,
      status:'running',
      attempt:current.attempt+1,
      version:current.version+1,
      leaseOwner:workerId,
      leaseToken:newLeaseToken(),
      leaseExpiresAt:new Date(now+leaseMs).toISOString(),
      updatedAt:new Date(now).toISOString(),
    });
    if(claimed.attempt>claimed.maxAttempts)throw new Error('WORK_SESSION_TASK_ATTEMPT_INVALID');
    this.tasks.set(taskKey,claimed);
    return claimed;
  }

  async renewLease(workSessionId:string,taskId:string,workerId:string,leaseToken:string,leaseMs:number):Promise<WorkSessionTask|null>{
    const taskKey=key(workSessionId,taskId);
    const current=this.tasks.get(taskKey);
    const now=Date.now();
    if(!current||current.status!=='running'||current.leaseOwner!==workerId||current.leaseToken!==leaseToken||!current.leaseExpiresAt||Date.parse(current.leaseExpiresAt)<=now)return null;
    const renewed=freezeTask({...current,version:current.version+1,leaseExpiresAt:new Date(now+leaseMs).toISOString(),updatedAt:new Date(now).toISOString()});
    this.tasks.set(taskKey,renewed);
    return renewed;
  }

  async releaseLease(workSessionId:string,taskId:string,workerId:string,leaseToken:string,nextStatus:WorkSessionTaskStatus,blockedReason?:string):Promise<WorkSessionTask|null>{
    const taskKey=key(workSessionId,taskId);
    const current=this.tasks.get(taskKey);
    const now=Date.now();
    if(!current||current.leaseOwner!==workerId||current.leaseToken!==leaseToken||!current.leaseExpiresAt||Date.parse(current.leaseExpiresAt)<=now)return null;
    const evolved=evolveWorkSessionTask(current,{status:nextStatus,blockedReason,updatedAt:new Date(now).toISOString()});
    const released=freezeTask({...evolved,leaseOwner:undefined,leaseToken:undefined,leaseExpiresAt:undefined});
    this.tasks.set(taskKey,released);
    return released;
  }
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

/**
 * Promote dependency-satisfied queued work into READY using optimistic writes.
 * This is coordination only; READY does not imply Action Core authorization.
 */
export async function reconcileWorkSessionTaskReadiness(
  repository:WorkSessionTaskRepository,
  workSessionId:string,
  updatedAt?:string,
):Promise<readonly WorkSessionTask[]>{
  const tasks=await repository.list(workSessionId);
  const candidates=listReadyWorkSessionTasks(tasks);
  const promoted:WorkSessionTask[]=[];
  for(const task of candidates){
    const ready=evolveWorkSessionTask(task,{status:'ready',updatedAt});
    await repository.update(ready,task.version);
    promoted.push(ready);
  }
  return Object.freeze(promoted);
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


function key(workSessionId:string,taskId:string):string{return `${workSessionId}:${taskId}`;}
function idempotencyKey(task:WorkSessionTask):string{return `${task.ownerUserId}:${task.workSessionId}:${task.idempotencyKey}`;}
function newLeaseToken():string{return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;}
