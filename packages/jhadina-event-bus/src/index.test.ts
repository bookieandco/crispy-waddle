import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DurableEventBus, InMemoryEventBus, InMemoryEventConsumerCheckpointStore, InMemoryEventJournal, replayWorkSessionEvents } from './index.js';

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
  const event=(id:string,key:string)=>({
    id,type:'director.render.completed',occurredAt:'2026-09-26T12:00:00.000Z',payload:{assetId:'asset-1'},
    context:{workSessionId:'ws-1',taskId:'task-1',correlationId:'corr-1',domain:'director',capability:'director.render',authorityRef:'action:123',idempotencyKey:key},
  });

  it('journals before dispatch and suppresses duplicate idempotency keys',async()=>{
    const journal=new InMemoryEventJournal();
    const bus=new DurableEventBus(journal);
    let seen=0;
    bus.subscribe('director.render.completed',()=>{seen+=1;});
    await bus.publish(event('evt-10','render-1'));
    await bus.publish(event('evt-11','render-1'));
    assert.equal(seen,1);
    assert.equal((await journal.listByWorkSession('ws-1')).length,1);
  });

  it('requires WorkSession correlation for durable cross-core events',async()=>{
    const bus=new DurableEventBus(new InMemoryEventJournal());
    await assert.rejects(()=>bus.publish({id:'evt-12',type:'x',occurredAt:'2026-09-26T12:00:00.000Z',payload:null}),/runtime context is required/);
  });
});


describe('event replay checkpoints',()=>{
  const make=(id:string,key:string,workSessionId='ws-replay')=>({
    id,type:'runtime.event',occurredAt:'2026-09-26T12:00:00.000Z',payload:{id},
    context:{workSessionId,correlationId:'corr-replay',domain:'runtime',idempotencyKey:key},
  });

  it('replays in journal order and resumes after the committed checkpoint',async()=>{
    const journal=new InMemoryEventJournal();
    await journal.append(make('e1','k1'));
    await journal.append(make('e2','k2'));
    await journal.append(make('other','other','ws-other'));
    await journal.append(make('e3','k3'));

    const checkpoints=new InMemoryEventConsumerCheckpointStore();
    const seen:string[]=[];
    const first=await replayWorkSessionEvents({
      journal,checkpoints,consumerId:'growth-consumer',workSessionId:'ws-replay',limit:2,
      now:'2026-09-26T12:01:00.000Z',handler:event=>{seen.push(event.id);},
    });
    assert.deepEqual(seen,['e1','e2']);
    assert.equal(first.processed,2);

    const second=await replayWorkSessionEvents({
      journal,checkpoints,consumerId:'growth-consumer',workSessionId:'ws-replay',
      now:'2026-09-26T12:02:00.000Z',handler:event=>{seen.push(event.id);},
    });
    assert.deepEqual(seen,['e1','e2','e3']);
    assert.equal(second.processed,1);
    assert.ok(second.checkpointOffset>first.checkpointOffset);
  });

  it('does not advance the checkpoint when a consumer fails',async()=>{
    const journal=new InMemoryEventJournal();
    await journal.append(make('e1','k1'));
    await journal.append(make('e2','k2'));
    const checkpoints=new InMemoryEventConsumerCheckpointStore();

    await assert.rejects(()=>replayWorkSessionEvents({
      journal,checkpoints,consumerId:'sam-consumer',workSessionId:'ws-replay',
      now:'2026-09-26T12:01:00.000Z',
      handler:event=>{if(event.id==='e2')throw new Error('CONSUMER_DOWN');},
    }),/CONSUMER_DOWN/);

    const checkpoint=await checkpoints.get('sam-consumer','ws-replay');
    assert.equal(checkpoint?.offset,1);
    const replayed:string[]=[];
    await replayWorkSessionEvents({
      journal,checkpoints,consumerId:'sam-consumer',workSessionId:'ws-replay',
      now:'2026-09-26T12:02:00.000Z',handler:event=>{replayed.push(event.id);},
    });
    assert.deepEqual(replayed,['e2']);
  });

  it('rejects stale concurrent checkpoint commits instead of skipping events',async()=>{
    const checkpoints=new InMemoryEventConsumerCheckpointStore();
    await checkpoints.commit({
      consumerId:'c1',workSessionId:'ws-replay',expectedOffset:0,nextOffset:4,updatedAt:'2026-09-26T12:00:00.000Z',
    });
    await assert.rejects(()=>checkpoints.commit({
      consumerId:'c1',workSessionId:'ws-replay',expectedOffset:0,nextOffset:5,updatedAt:'2026-09-26T12:00:01.000Z',
    }),/CHECKPOINT_CONFLICT/);
  });
});
