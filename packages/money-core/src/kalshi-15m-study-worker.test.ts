import assert from 'node:assert/strict';
import test from 'node:test';
import {Kalshi15mContinuousStudyWorker, type KalshiReadOnlyFeed} from './kalshi-15m-study-worker.js';
import type {KalshiStudyReceipt} from './kalshi-15m-study-recorder.js';

const close=Date.UTC(2026,9,13,17);
const ticker='KXBTC15M-26OCT131700';
const market=()=>({ticker,event_ticker:ticker,status:'active',strike_type:'greater',
  close_time:new Date(close).toISOString(),floor_strike:83531.59,
  rules_primary:'BRTI above threshold',rules_secondary:'60-second reference average'});
const book=(time:number)=>({type:'orderbook_snapshot',sid:1,seq:1,sending_ts_ms:time,
  msg:{market_ticker:ticker,yes_dollars_fp:[['0.9000','5.00']],no_dollars_fp:[['0.0800','5.00']]}});
const index=(time:number)=>({type:'cfbenchmarks_value',sid:2,seq:1,sending_ts_ms:time,
  msg:{index_id:'BRTI',data:JSON.stringify({type:'value',id:'BRTI',time,value:'83603.89'})}});

test('worker only opens read-only streams and persists on-time checkpoints',async()=>{
  let now=close-600_000;
  const recorded:KalshiStudyReceipt[]=[];
  let subscribed=0, closed=0;
  const feed:KalshiReadOnlyFeed={authority:'LIVE_READ_ONLY',
    subscribe:async (_ticker,receive)=>{
      subscribed++;
      receive(book(now),now);receive(index(now),now);
      return {close:async()=>{closed++;}};
    }};
  const worker=new Kalshi15mContinuousStudyWorker({
    now:()=>now,listMarkets:async()=>[market()],feed,
    sink:{append:async r=>{recorded.push(r);},has:id=>recorded.some(r=>r.id===id)},
  });
  const first=await worker.cycle();
  assert.equal(first?.direction,'ABSTAIN');
  assert.equal(first?.baselineDirection,'UP');
  assert.equal(worker.health().state,'STREAMING');
  assert.equal(worker.health().canSubmitOrders,false);
  assert.equal(subscribed,1);
  assert.equal((await worker.cycle()),null);
  now=close-300_000;
  const second=await worker.cycle();
  assert.equal(second?.direction,'ABSTAIN');
  assert.equal(second?.baselineDirection,null); // stale reference, no fake current guess
  assert.equal(recorded.length,2);
  await worker.stop();
  assert.equal(worker.health().state,'STOPPED');
  assert.equal(closed,1);
});

test('socket disconnect resets sources and cannot reuse stale book at next checkpoint',async()=>{
  let now=close-600_000;
  const recorded:KalshiStudyReceipt[]=[];
  let disconnect=()=>{};
  let generation=0;
  const feed:KalshiReadOnlyFeed={authority:'LIVE_READ_ONLY',subscribe:async (_,receive,onDisconnect)=>{
    generation++;
    disconnect=onDisconnect;
    if(generation===1){receive(book(now),now);receive(index(now),now);}
    return {close:async()=>{}};
  }};
  const worker=new Kalshi15mContinuousStudyWorker({
    now:()=>now,listMarkets:async()=>[market()],feed,
    sink:{append:async r=>{recorded.push(r);},has:id=>recorded.some(r=>r.id===id)},
  });
  await worker.cycle();
  disconnect();
  assert.equal(worker.health().state,'DISCONNECTED');
  now=close-300_000;
  const r=await worker.cycle();
  assert.equal(generation,2);
  assert.equal(r?.direction,'ABSTAIN');
  assert.equal(r?.baselineDirection,null);
  assert.equal(recorded.length,2);
  await worker.stop();
});

test('worker refuses feeds claiming execution authority',()=>{
  assert.throws(()=>new Kalshi15mContinuousStudyWorker({
    now:()=>close-600_000,listMarkets:async()=>[],sink:{append:async()=>{},has:()=>false},
    feed:{authority:'LIVE_TRADING'} as unknown as KalshiReadOnlyFeed,
  }),/READ_ONLY/);
});

test('worker cannot claim durability when sink failed',async()=>{
  let now=close-600_000;
  const worker=new Kalshi15mContinuousStudyWorker({
    now:()=>now,listMarkets:async()=>[market()],
    feed:{authority:'LIVE_READ_ONLY',subscribe:async()=>({close:async()=>{}})},
    sink:{append:async()=>{throw new Error('DISK_FAILED');},has:()=>false},
  });
  await assert.rejects(()=>worker.cycle(),/DURABLE_WRITE_FAILED/);
  assert.equal(worker.health().state,'FAILED');
  await worker.stop();
});
