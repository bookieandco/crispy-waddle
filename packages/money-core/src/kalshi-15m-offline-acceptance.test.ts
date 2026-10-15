import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import test from 'node:test';
import {Kalshi15mFastPaper} from './kalshi-15m-fast-paper.js';
import {
  KalshiStudyJsonlStore, Kalshi15mStudySession,
  parseKalshi15mMarket, type KalshiStudyReceipt,
} from './kalshi-15m-study-recorder.js';
import {Kalshi15mContinuousStudyWorker, type KalshiReadOnlyFeed} from './kalshi-15m-study-worker.js';
import {readKalshiStudyLedger, KalshiGoogleSheetsResearchWriter} from './kalshi-15m-google-sheets-writer.js';
import {projectKalshiStudyCoverage} from './kalshi-15m-coverage.js';

const close1=Date.UTC(2026,9,13,17), close2=close1+900_000;
const first='KXBTC15M-26OCT131700', second='KXBTC15M-26OCT131715';
function market(ticker:string,closes:number){
  return {ticker,event_ticker:ticker,status:'active',
    strike_type:'greater_or_equal',close_time:new Date(closes).toISOString(),
    floor_strike:83531.59,rules_primary:'BRTI >= threshold',
    rules_secondary:'final BRTI one-minute averaging rule'};
}
function book(ticker:string,at:number,seq=1):unknown {
  return {type:'orderbook_snapshot',sid:1,seq,sending_ts_ms:at,
    msg:{market_ticker:ticker,yes_dollars_fp:[['0.65','5']],
      no_dollars_fp:[['0.30','5']]}};
}
function index(at:number):unknown {
  return {type:'cfbenchmarks_value',sid:2,seq:1,sending_ts_ms:at,
    msg:{index_id:'BRTI',data:JSON.stringify({
      id:'BRTI',type:'value',time:at,value:'83600.00',
    })}};
}

test('KALSHI.06.01 rejects delayed and malformed book data without stale reuse',()=>{
  const now=close1-600_000;
  const engine=new Kalshi15mFastPaper({
    marketTicker:first,targetUsd:83531.59,closeAtMs:close1,
  });
  assert.equal(engine.ingest(book(first,now),now),'BOOK_READY');
  assert.equal(engine.ingest(index(now),now),'INDEX_READY');
  assert.equal(engine.snapshot(now).bookFresh,true);
  assert.equal(engine.ingest({type:'orderbook_delta',sid:1,seq:2,
    sending_ts_ms:now-9000,msg:{
      market_ticker:first,side:'yes',price_dollars:'0.65',delta_fp:'1',
    }},now+100),'BOOK_RESNAPSHOT_REQUIRED');
  assert.equal(engine.snapshot(now+100).bookFresh,false);
  assert.equal(engine.ingest(book(first,now+200),now+200),'BOOK_READY');
  assert.equal(engine.ingest({type:'orderbook_delta',sid:1,
    sending_ts_ms:now+300,msg:{
      market_ticker:first,side:'yes',price_dollars:'0.65',delta_fp:'1',
    }},now+300),'BOOK_RESNAPSHOT_REQUIRED');
  assert.equal(engine.snapshot(now+300).needsResnapshot,true);
  assert.equal(engine.ingest(book(first,now-10000),now+500),'BOOK_RESNAPSHOT_REQUIRED');
  assert.equal(engine.snapshot(now+500).bookFresh,false);
});

test('KALSHI.06.02-.08 deterministic rollover, journal, gaps, coverage and archive boundary',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'kalshi06-'));
  const journalPath=join(dir,'receipts.jsonl');
  const events:{at:string;code:string;fromTicker:string|null;toTicker:string|null}[]=[];
  try{
    const store=await KalshiStudyJsonlStore.open(journalPath);
    let clock=close1-600_000;
    const receivers=new Map<string,(frame:unknown,at:number)=>void>();
    const feed:KalshiReadOnlyFeed={authority:'LIVE_READ_ONLY',
      subscribe:async(ticker,receive)=>{
        receivers.set(ticker,receive);
        receive(book(ticker,clock),clock);
        receive(index(clock),clock);
        return {close:async()=>{}};
      },
    };
    const listMarkets=async()=>[market(first,close1),market(second,close2)];
    const worker=new Kalshi15mContinuousStudyWorker({
      now:()=>clock,listMarkets,feed,sink:store,
      onEvent:e=>events.push(e),
    });
    assert.equal((await worker.cycle())?.direction,'ABSTAIN'); // 1 / T-600
    clock=close1-300_000;
    assert.equal((await worker.cycle())?.direction,'ABSTAIN'); // 1 / T-300
    clock=close2-600_000; // skip old T-60 and rollover via verified metadata
    assert.equal((await worker.cycle())?.marketTicker,second); // 2 / T-600
    receivers.get(first)?.(book(first,clock),clock); // old-generation frame
    clock=close2-60_000; // skip second T-300
    assert.equal((await worker.cycle())?.direction,'ABSTAIN'); // 2 / T-60
    await worker.stop();
    const records=await readKalshiStudyLedger(journalPath);
    assert.equal(records.length,4);
    assert.equal(new Set(records.map(r=>r.id)).size,4);
    assert.ok(records.every(r=>r.paperOnly && !r.canSubmitOrders &&
      r.settlementStatus==='PENDING' && r.officialOutcome===null));
    const rollover=events.filter(e=>e.code==='MARKET_ROLLOVER');
    assert.ok(rollover.some(e=>e.fromTicker===first && e.toTicker===second));

    const markets=[
      parseKalshi15mMarket(market(first,close1),close1-900_000),
      parseKalshi15mMarket(market(second,close2),close2-900_000),
    ];
    const report=projectKalshiStudyCoverage({
      scope:'SYNTHETIC_TEST',markets,receipts:records,
    });
    assert.equal(report.expected,6);
    assert.equal(report.abstained,4);
    assert.equal(report.notObserved,2);
    assert.equal(report.verifiedSettlements,0);
    assert.equal(report.rows.filter(r=>r.outcomeStatus==='PENDING_SETTLEMENT').length,4);
    assert.ok(report.rows.filter(r=>r.status==='NOT_OBSERVED')
      .every(r=>r.receiptHash===null && r.observedAt===null));
    // An attempt to invent a fifth observation is rejected, not projected.
    await assert.rejects(async()=>projectKalshiStudyCoverage({
      scope:'SYNTHETIC_TEST',markets,receipts:[
        ...records,{...records[0]!,observationHash:'0'.repeat(64)},
      ],
    }),/RECEIPT_INVALID/);
    const reopened=await KalshiStudyJsonlStore.open(journalPath);
    assert.ok(reopened.has(first+':600'));
    await assert.rejects(()=>reopened.append(records[0]!),/DUPLICATE/);

    // Google returns a timeout AFTER accepting an append. The retry reads
    // remote evidence and must not send a second POST or mutate the journal.
    const remote:unknown[][]=[];
    let posts=0,failAfterCommit=true;
    const fakeFetch=(async(_url:string|URL|Request,init?:RequestInit)=>{
      if(init?.method==='GET')
        return new Response(JSON.stringify({values:remote}),{status:200});
      if(init?.method==='POST'){
        posts++;
        const row=JSON.parse(String(init.body)).values[0] as unknown[];
        remote.push(row);
        if(failAfterCommit){failAfterCommit=false;throw new Error('simulated timeout');}
        return new Response('{}',{status:200});
      }
      throw new Error('unexpected request');
    }) as typeof fetch;
    const writer=new KalshiGoogleSheetsResearchWriter({
      tokens:{accessToken:async()=> 'offline-test-token'},
      fetchImpl:fakeFetch,
    });
    await assert.rejects(()=>writer.flush(records),/timeout/);
    const reconciled=await writer.flush(records);
    assert.equal(reconciled.alreadyPresent,1);
    assert.equal(reconciled.saved,3);
    assert.equal(posts,4);
    const replay=await writer.flush(records);
    assert.equal(replay.saved,0);
    assert.equal(replay.alreadyPresent,4);
    assert.equal(posts,4);
    assert.equal(remote.length,4);
    assert.equal((await readKalshiStudyLedger(journalPath)).length,4);
    await assert.rejects(()=>new KalshiGoogleSheetsResearchWriter({
      tokens:{accessToken:async()=>{throw new Error('no worker grant');}},
      fetchImpl:fakeFetch,
    }).flush(records),/no worker grant/);
    const receiptBefore=await readFile(journalPath,'utf8');

    // Optional CI-only evidence artifacts; never report real observations.
    const output=process.env.KALSHI_VALIDATION_ARTIFACT_DIR;
    if(output){
      await mkdir(output,{recursive:true});
      await writeFile(join(output,'receipts.jsonl'),receiptBefore);
      await writeFile(join(output,'coverage.json'),JSON.stringify(report,null,2)+'\n');
      await writeFile(join(output,'health-events.jsonl'),
        events.map(e=>JSON.stringify(e)).join('\n')+'\n');
      await writeFile(join(output,'archive-reconciliation.json'),JSON.stringify({
        scope:'OFFLINE_MOCK',...reconciled,replay,posts,remoteRows:remote.length,
      },null,2)+'\n');
      await writeFile(join(output,'validation-summary.json'),JSON.stringify({
        result:'OFFLINE_FIXTURE_PASSED',liveTransport:'NOT_VALIDATED',
        hosting:'NOT_COMMISSIONED',settlement:'UNVERIFIED',
        windows:2,horizons:6,receipts:4,missing:2,
        paperOnly:true,canSubmitOrders:false,
      },null,2)+'\n');
    }
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('KALSHI.06.03 drops gap-tainted generations before the next checkpoint',async()=>{
  const receipts:KalshiStudyReceipt[]=[];
  const events:string[]=[];
  const listeners:((frame:unknown,at:number)=>void)[]=[];
  let now=close1-600_000,generation=0;
  const feed:KalshiReadOnlyFeed={authority:'LIVE_READ_ONLY',
    subscribe:async(_ticker,receive)=>{
      listeners.push(receive);generation++;
      if(generation===1){
        receive(book(first,now),now);receive(index(now),now);
      }
      // Reconnect has no source snapshot/index; no old value is permitted.
      return {close:async()=>{}};
    },
  };
  const worker=new Kalshi15mContinuousStudyWorker({
    now:()=>now,listMarkets:async()=>[market(first,close1)],feed,
    sink:{append:async r=>{receipts.push(r);},
      has:id=>receipts.some(r=>r.id===id)},
    onEvent:e=>events.push(e.code),
  });
  const initial=await worker.cycle();
  assert.equal(initial?.baselineDirection,'UP');
  listeners[0]?.({type:'orderbook_delta',sid:1,seq:9,
    sending_ts_ms:now+50,msg:{market_ticker:first,side:'yes',
      price_dollars:'0.65',delta_fp:'1'}},now+50);
  assert.equal(worker.health().state,'DISCONNECTED');
  assert.ok(events.includes('BOOK_SEQUENCE_GAP'));
  now=close1-300_000;
  const after=await worker.cycle();
  assert.equal(generation,2);
  assert.equal(after?.direction,'ABSTAIN');
  assert.equal(after?.baselineDirection,null);
  assert.equal(after?.yesAskUsd,null);
  assert.equal(receipts.length,2);
  await worker.stop();
});

test('KALSHI.06.04 serializes concurrent duplicate writes and refuses corruption',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'kalshi06-journal-'));
  const path=join(dir,'receipts.jsonl');
  try{
    const store=await KalshiStudyJsonlStore.open(path);
    const m=parseKalshi15mMarket(market(first,close1),close1-900_000);
    const s=new Kalshi15mStudySession(m,{append:async()=>{}});
    const receipt=await s.checkpoint({nowMs:close1-600_000});
    assert.ok(receipt);
    const attempts=await Promise.allSettled([
      store.append(receipt!),store.append(receipt!),
    ]);
    assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);
    assert.equal((await readKalshiStudyLedger(path)).length,1);
    const data=await readFile(path,'utf8');
    await writeFile(path,data.slice(0,-1));
    await assert.rejects(()=>KalshiStudyJsonlStore.open(path),/PARTIAL_LEDGER/);
    await assert.rejects(()=>readKalshiStudyLedger(path),/PARTIAL_JOURNAL/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
