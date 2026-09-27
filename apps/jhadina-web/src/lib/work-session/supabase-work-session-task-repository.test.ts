import {describe,expect,it} from 'vitest';
import {createWorkSessionTask,evolveWorkSessionTask} from '@jhadina/core-spine';
import {SupabaseWorkSessionTaskRepository} from './supabase-work-session-task-repository';

function baseTask(){
  return createWorkSessionTask({
    id:'task-1',
    workSessionId:'ws-1',
    ownerUserId:'00000000-0000-0000-0000-000000000001',
    domain:'director',
    capability:'director.render',
    authorityRef:'context-only',
    idempotencyKey:'idem-1',
    correlationId:'corr-1',
    createdAt:'2026-09-27T00:00:00.000Z',
  });
}

describe('SupabaseWorkSessionTaskRepository',()=>{
  it('rejects cross-owner persistence before touching the database',async()=>{
    let touched=false;
    const client={
      from:()=>{touched=true;return{insert:async()=>({error:null})};},
      rpc:async()=>({data:[],error:null}),
    } as any;
    const repo=new SupabaseWorkSessionTaskRepository(client,'another-owner');
    await expect(repo.create(baseTask())).rejects.toThrow('WORK_SESSION_TASK_OWNER_MISMATCH');
    expect(touched).toBe(false);
  });

  it('uses atomic RPC claim and rehydrates lease state',async()=>{
    const calls:any[]=[];
    const row={
      id:'task-1',work_session_id:'ws-1',owner_user_id:'00000000-0000-0000-0000-000000000001',
      parent_task_id:null,domain:'director',capability:'director.render',status:'running',
      authority_ref:'context-only',idempotency_key:'idem-1',correlation_id:'corr-1',causation_id:null,
      dependency_ids:[],input_refs:[],output_refs:[],blocked_reason:null,attempt:1,max_attempts:3,version:2,
      lease_owner:'worker-a',lease_token:'lease-a',lease_expires_at:'2026-09-27T00:01:00.000Z',
      created_at:'2026-09-27T00:00:00.000Z',updated_at:'2026-09-27T00:00:01.000Z',
    };
    const client={
      from:()=>({}),
      rpc:async(name:string,args:any)=>{calls.push({name,args});return{data:[row],error:null};},
    } as any;
    const repo=new SupabaseWorkSessionTaskRepository(client,row.owner_user_id);
    const claimed=await repo.claimReady('ws-1','task-1','worker-a',60_000);
    expect(claimed).toMatchObject({status:'running',leaseOwner:'worker-a',leaseToken:'lease-a',attempt:1});
    expect(calls[0]?.name).toBe('jhadina_claim_work_session_task');
    expect(calls[0]?.args.p_owner_user_id).toBe(row.owner_user_id);
  });

  it('rejects stale optimistic updates before relying on database CAS',async()=>{
    const task=baseTask();
    const ready=evolveWorkSessionTask(task,{status:'ready'});
    const client={from:()=>({})} as any;
    const repo=new SupabaseWorkSessionTaskRepository(client,task.ownerUserId);
    await expect(repo.update(ready,99)).rejects.toThrow('WORK_SESSION_TASK_VERSION_CONFLICT');
  });
});
