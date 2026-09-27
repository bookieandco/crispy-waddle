import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DurableEventBus,
  InMemoryEventBus,
  InMemoryEventJournal,
  InMemoryEventConsumerCheckpointStore,
  SupabaseEventJournal,
  SupabaseEventConsumerCheckpointStore,
} from './index.js';

const runtimeEvent=(id:string,key:string)=>({
  id,type:'director.render.completed',occurredAt:'2026-09-26T12:00:00.000Z',payload:{assetId:'asset-1'},
  context:{workSessionId:'ws-1',taskId:'task-1',correlationId:'corr-1',domain:'director',capability:'director.render',authorityRef:'action:123',idempotencyKey:key},
});

describe('InMemoryEventBus', () => {
  it('publishes events to subscribers in registration order', async () => {
    const bus = new InMemoryEventBus();
    const seen: string[] = [];
    bus.subscribe('overage.reviewed', async (event) => { seen.push(`first:${event.id}`); });
    bus.subscribe('overage.reviewed', async (event) => { seen.push(`second:${event.id}`); });

    await bus.publish({ id: 'evt-1', type: 'overage.reviewed', occurredAt: '2026-08-22T12:00:00.000Z', payload: { opportunityId: 'opp-1' } });
    assert.deepEqual(seen, ['first:evt-1', 'second:evt-1']);
  });

  it('supports unsubscribe without affecting other subscribers', async () => {
    const bus = new InMemoryEventBus();
    let first = 0;
    let second = 0;
    const unsubscribe = bus.subscribe('reviewed', () => { first += 1; });
    bus.subscribe('reviewed', () => { second += 1; });
    unsubscribe();

    await bus.publish({ id: 'evt-2', type: 'reviewed', occurredAt: '2026-08-22T12:00:00.000Z', payload: null });
    assert.equal(first, 0);
    assert.equal(second, 1);
  });

  it('fails closed on malformed events', async () => {
    const bus = new InMemoryEventBus();
    await assert.rejects(() => bus.publish({ id: '', type: 'reviewed', occurredAt: '', payload: null }), /Invalid domain event/);
  });
});


describe('DurableEventBus',()=>{
  it('journals before dispatch and suppresses duplicate idempotency keys',async()=>{
    const journal=new InMemoryEventJournal();
    const bus=new DurableEventBus(journal);
    let seen=0;
    bus.subscribe('director.render.completed',()=>{seen+=1;});
    await bus.publish(runtimeEvent('evt-10','render-1'));
    await bus.publish(runtimeEvent('evt-11','render-1'));
    assert.equal(seen,1);
    assert.equal((await journal.listByWorkSession('ws-1')).length,1);
  });

  it('requires WorkSession correlation for durable cross-core events',async()=>{
    const bus=new DurableEventBus(new InMemoryEventJournal());
    await assert.rejects(()=>bus.publish({id:'evt-12',type:'x',occurredAt:'2026-09-26T12:00:00.000Z',payload:null}),/runtime context is required/);
  });
});


describe('SupabaseEventJournal',()=>{
  it('maps duplicate unique violations to duplicate without dispatch ambiguity',async()=>{
    const db={
      rpc:async()=>({data:[],error:null}),
      from:()=>({
        insert:async()=>({error:{code:'23505',message:'duplicate key'}}),
        select:()=>({eq:()=>({order:async()=>({data:[],error:null})})}),
      }),
    };
    const journal=new SupabaseEventJournal(db);
    await assert.doesNotReject(async()=>{
      const result=await journal.append(runtimeEvent('evt-db-1','idem-db-1'));
      assert.equal(result,'duplicate');
    });
  });

  it('rehydrates ordered runtime lineage from persisted rows',async()=>{
    const db={
      rpc:async()=>({data:[],error:null}),
      from:()=>({
        insert:async()=>({error:null}),
        select:()=>({eq:()=>({order:async()=>({
          data:[{
            id:'evt-db-2',event_type:'director.render.completed',occurred_at:'2026-09-26T12:00:00.000Z',
            payload:{assetId:'asset-1'},work_session_id:'ws-1',task_id:'task-1',correlation_id:'corr-1',
            causation_id:null,actor_id:'user-1',domain:'director',capability:'director.render',
            authority_ref:'action:123',idempotency_key:'idem-db-2',
          }],error:null,
        })})}),
      }),
    };
    const journal=new SupabaseEventJournal(db);
    const rows=await journal.listByWorkSession('ws-1');
    assert.equal(rows.length,1);
    assert.equal(rows[0]?.context?.taskId,'task-1');
    assert.equal(rows[0]?.context?.actorId,'user-1');
  });
});


describe('Runtime event replay checkpoints',()=>{
  it('replays only events after a durable sequence and advances checkpoint with CAS',async()=>{
    const journal=new InMemoryEventJournal();
    await journal.append(runtimeEvent('evt-r1','replay-1'));
    await journal.append(runtimeEvent('evt-r2','replay-2'));
    const page=await journal.readAfter('ws-1',1,10);
    assert.equal(page.length,1);
    assert.equal(page[0]?.sequenceId,2);
    assert.equal(page[0]?.event.id,'evt-r2');

    const checkpoints=new InMemoryEventConsumerCheckpointStore();
    assert.equal(await checkpoints.get('sam-consumer','ws-1'),0);
    assert.equal(await checkpoints.advance('sam-consumer','ws-1',0,2),true);
    assert.equal(await checkpoints.advance('sam-consumer','ws-1',0,3),false);
    assert.equal(await checkpoints.get('sam-consumer','ws-1'),2);
  });

  it('uses Supabase RPCs for replay and monotonic checkpoint advancement',async()=>{
    const calls:Array<{name:string;args:Record<string,unknown>}>= [];
    const db={
      rpc:async(name:string,args:Record<string,unknown>)=>{
        calls.push({name,args});
        if(name==='jhadina_read_runtime_events_after')return{data:[{
          sequence_id:4,id:'evt-db-r4',event_type:'sam.notice.discovered',
          occurred_at:'2026-09-27T00:00:00Z',payload:{noticeId:'n-1'},
          work_session_id:'ws-1',task_id:'sam-task',correlation_id:'corr-1',
          causation_id:null,actor_id:'system',domain:'sam',capability:'sam.refresh',
          authority_ref:null,idempotency_key:'sam-event-4',
        }],error:null};
        if(name==='jhadina_get_runtime_event_checkpoint')return{data:3,error:null};
        if(name==='jhadina_advance_runtime_event_checkpoint')return{data:true,error:null};
        return{data:null,error:null};
      },
      from:()=>({
        insert:async()=>({error:null}),
        select:()=>({eq:()=>({order:async()=>({data:[],error:null})})}),
      }),
    };
    const journal=new SupabaseEventJournal(db);
    const page=await journal.readAfter('ws-1',3,25);
    assert.equal(page[0]?.sequenceId,4);
    assert.equal(page[0]?.event.type,'sam.notice.discovered');

    const checkpoints=new SupabaseEventConsumerCheckpointStore(db);
    assert.equal(await checkpoints.get('sam-consumer','ws-1'),3);
    assert.equal(await checkpoints.advance('sam-consumer','ws-1',3,4),true);
    assert.deepEqual(calls.map(call=>call.name),[
      'jhadina_read_runtime_events_after',
      'jhadina_get_runtime_event_checkpoint',
      'jhadina_advance_runtime_event_checkpoint',
    ]);
  });
});
