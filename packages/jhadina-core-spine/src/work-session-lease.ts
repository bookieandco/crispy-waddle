import {
  evolveWorkSessionTask,
  listReadyWorkSessionTasks,
  type WorkSessionTask,
  type WorkSessionTaskRepository,
  type WorkSessionTaskStatus,
} from './work-session.js';

export interface WorkSessionTaskLease {
  workSessionId:string;
  taskId:string;
  ownerUserId:string;
  workerId:string;
  leaseToken:string;
  claimedAt:string;
  heartbeatAt:string;
  expiresAt:string;
}

export interface WorkSessionTaskClaim {
  task:WorkSessionTask;
  lease:WorkSessionTaskLease;
}

export interface WorkSessionTaskLeaseManager {
  claim(input:{
    workSessionId:string;
    ownerUserId:string;
    workerId:string;
    leaseToken:string;
    now:string;
    leaseDurationMs:number;
    capabilityNames?:readonly string[];
  }):Promise<WorkSessionTaskClaim|null>;
  heartbeat(input:{workSessionId:string;taskId:string;workerId:string;leaseToken:string;now:string;leaseDurationMs:number}):Promise<WorkSessionTaskLease>;
  finish(input:{
    workSessionId:string;
    taskId:string;
    workerId:string;
    leaseToken:string;
    now:string;
    status:Extract<WorkSessionTaskStatus,'completed'|'failed'|'retrying'|'paused'|'blocked'|'cancelled'>;
    blockedReason?:string;
    outputRefs?:readonly string[];
  }):Promise<WorkSessionTask>;
  recoverExpired(workSessionId:string,now:string):Promise<readonly WorkSessionTask[]>;
  getLease(workSessionId:string,taskId:string):Promise<WorkSessionTaskLease|null>;
}

/**
 * Source-level worker coordination model.
 *
 * This proves scheduling semantics for subsystem adapters before the production
 * Postgres/Supabase claim primitive exists. It is NOT a production durability
 * claim: process death loses these leases. Production must implement the same
 * contract atomically in the database.
 */
export class InMemoryWorkSessionTaskLeaseManager implements WorkSessionTaskLeaseManager {
  private readonly leases=new Map<string,WorkSessionTaskLease>();

  constructor(private readonly tasks:WorkSessionTaskRepository){}

  async getLease(workSessionId:string,taskId:string):Promise<WorkSessionTaskLease|null>{
    return this.leases.get(key(workSessionId,taskId))??null;
  }

  async claim(input:{
    workSessionId:string;ownerUserId:string;workerId:string;leaseToken:string;now:string;leaseDurationMs:number;capabilityNames?:readonly string[];
  }):Promise<WorkSessionTaskClaim|null>{
    validateLeaseInput(input.workerId,input.leaseToken,input.now,input.leaseDurationMs);
    await this.promoteDependencyReady(input.workSessionId,input.now);
    await this.recoverExpired(input.workSessionId,input.now);

    const allowed=input.capabilityNames?new Set(input.capabilityNames):null;
    const candidates=(await this.tasks.list(input.workSessionId))
      .filter(task=>task.ownerUserId===input.ownerUserId)
      .filter(task=>task.status==='ready'||task.status==='retrying')
      .filter(task=>task.attempt<task.maxAttempts)
      .filter(task=>!allowed||allowed.has(task.capability))
      .sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));

    for(const task of candidates){
      if(this.leases.has(key(task.workSessionId,task.id)))continue;
      const running=evolveWorkSessionTask(task,{
        status:'running',
        attempt:task.attempt+1,
        updatedAt:input.now,
      });
      try{
        await this.tasks.update(running,task.version);
      }catch(error){
        if(error instanceof Error&&/VERSION_CONFLICT/.test(error.message))continue;
        throw error;
      }
      const lease=freezeLease({
        workSessionId:task.workSessionId,
        taskId:task.id,
        ownerUserId:task.ownerUserId,
        workerId:input.workerId,
        leaseToken:input.leaseToken,
        claimedAt:input.now,
        heartbeatAt:input.now,
        expiresAt:addMs(input.now,input.leaseDurationMs),
      });
      this.leases.set(key(task.workSessionId,task.id),lease);
      return Object.freeze({task:running,lease});
    }
    return null;
  }

  async heartbeat(input:{workSessionId:string;taskId:string;workerId:string;leaseToken:string;now:string;leaseDurationMs:number}):Promise<WorkSessionTaskLease>{
    validateLeaseInput(input.workerId,input.leaseToken,input.now,input.leaseDurationMs);
    const lease=this.requireLease(input.workSessionId,input.taskId,input.workerId,input.leaseToken);
    if(Date.parse(lease.expiresAt)<=Date.parse(input.now))throw new Error('WORK_SESSION_TASK_LEASE_EXPIRED');
    const next=freezeLease({...lease,heartbeatAt:input.now,expiresAt:addMs(input.now,input.leaseDurationMs)});
    this.leases.set(key(input.workSessionId,input.taskId),next);
    return next;
  }

  async finish(input:{
    workSessionId:string;taskId:string;workerId:string;leaseToken:string;now:string;
    status:Extract<WorkSessionTaskStatus,'completed'|'failed'|'retrying'|'paused'|'blocked'|'cancelled'>;
    blockedReason?:string;outputRefs?:readonly string[];
  }):Promise<WorkSessionTask>{
    parseIso(input.now,'WORK_SESSION_TASK_FINISH_TIME_INVALID');
    const lease=this.requireLease(input.workSessionId,input.taskId,input.workerId,input.leaseToken);
    if(Date.parse(lease.expiresAt)<=Date.parse(input.now))throw new Error('WORK_SESSION_TASK_LEASE_EXPIRED');
    const current=await this.tasks.get(input.workSessionId,input.taskId);
    if(!current)throw new Error('WORK_SESSION_TASK_NOT_FOUND');
    if(current.status!=='running')throw new Error('WORK_SESSION_TASK_NOT_RUNNING');
    const next=evolveWorkSessionTask(current,{
      status:input.status,
      blockedReason:input.blockedReason,
      outputRefs:input.outputRefs,
      updatedAt:input.now,
    });
    await this.tasks.update(next,current.version);
    this.leases.delete(key(input.workSessionId,input.taskId));
    return next;
  }

  async recoverExpired(workSessionId:string,now:string):Promise<readonly WorkSessionTask[]>{
    const nowMs=parseIso(now,'WORK_SESSION_TASK_RECOVERY_TIME_INVALID');
    const recovered:WorkSessionTask[]=[];
    for(const [leaseKey,lease] of [...this.leases.entries()]){
      if(lease.workSessionId!==workSessionId||Date.parse(lease.expiresAt)>nowMs)continue;
      const current=await this.tasks.get(workSessionId,lease.taskId);
      this.leases.delete(leaseKey);
      if(!current||current.status!=='running')continue;
      const status:WorkSessionTaskStatus=current.attempt<current.maxAttempts?'retrying':'failed';
      const next=evolveWorkSessionTask(current,{status,updatedAt:now});
      try{
        await this.tasks.update(next,current.version);
        recovered.push(next);
      }catch(error){
        if(!(error instanceof Error&&/VERSION_CONFLICT/.test(error.message)))throw error;
      }
    }
    return Object.freeze(recovered);
  }

  private async promoteDependencyReady(workSessionId:string,now:string):Promise<void>{
    const tasks=await this.tasks.list(workSessionId);
    for(const task of listReadyWorkSessionTasks(tasks)){
      const ready=evolveWorkSessionTask(task,{status:'ready',updatedAt:now});
      try{
        await this.tasks.update(ready,task.version);
      }catch(error){
        if(!(error instanceof Error&&/VERSION_CONFLICT/.test(error.message)))throw error;
      }
    }
  }

  private requireLease(workSessionId:string,taskId:string,workerId:string,leaseToken:string):WorkSessionTaskLease{
    const lease=this.leases.get(key(workSessionId,taskId));
    if(!lease)throw new Error('WORK_SESSION_TASK_LEASE_NOT_FOUND');
    if(lease.workerId!==workerId||lease.leaseToken!==leaseToken)throw new Error('WORK_SESSION_TASK_LEASE_OWNER_MISMATCH');
    return lease;
  }
}

function validateLeaseInput(workerId:string,leaseToken:string,now:string,duration:number):void{
  if(!workerId.trim()||!leaseToken.trim())throw new Error('WORK_SESSION_TASK_LEASE_IDENTITY_REQUIRED');
  parseIso(now,'WORK_SESSION_TASK_LEASE_TIME_INVALID');
  if(!Number.isInteger(duration)||duration<1_000||duration>60*60*1_000)throw new Error('WORK_SESSION_TASK_LEASE_DURATION_INVALID');
}

function addMs(iso:string,ms:number):string{return new Date(parseIso(iso,'WORK_SESSION_TASK_LEASE_TIME_INVALID')+ms).toISOString();}
function parseIso(value:string,code:string):number{const parsed=Date.parse(value);if(Number.isNaN(parsed))throw new Error(code);return parsed;}
function key(workSessionId:string,taskId:string):string{return `${workSessionId}:${taskId}`;}
function freezeLease(lease:WorkSessionTaskLease):WorkSessionTaskLease{return Object.freeze({...lease});}
