import assert from 'node:assert/strict';
import {mkdtemp, rm, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {
  Kalshi15mStudySession, KalshiStudyJsonlStore, chooseKalshi15mMarket,
  parseKalshi15mMarket, fetchKalshi15mMarkets, kalshiStudySheetRows,
  type KalshiStudyReceipt,
} from './kalshi-15m-study-recorder.js';

const closeAt = Date.UTC(2026, 9, 13, 17, 0, 0);
const ticker='KXBTC15M-26OCT131700';
const marketInput=()=>({
  ticker,event_ticker:'KXBTC15M-26OCT131700', status:'active',
  close_time:new Date(closeAt).toISOString(),floor_strike:83531.59,
  strike_type:'greater',rules_primary:'BTC BRTI above price at expiry',
  rules_secondary:'Average settlement index, see official rules',
});
const market=()=>parseKalshi15mMarket(marketInput(),closeAt-650_000);
const book=(t:number)=>({type:'orderbook_snapshot',sid:1,seq:1,sending_ts_ms:t,
  msg:{market_ticker:ticker,yes_dollars_fp:[['0.9300','2.00']],no_dollars_fp:[['0.0600','3.00']]}});
const tick=(t:number)=>({type:'cfbenchmarks_value',sid:2,seq:1,sending_ts_ms:t,
  msg:{index_id:'BRTI',data:JSON.stringify({type:'value',id:'BRTI',time:t,value:'83603.89'})}});
const model=(time:number)=>({marketTicker:ticker,modelId:'synthetic-model-v1',
  evidenceIds:['synthetic:unit'],observedAtMs:time,probabilityUp:0.99});

test('rejects fake or unverifiable metadata and ambiguous windows',()=>{
  const time=closeAt-650_000;
  assert.equal(market().targetUsd,83531.59);
  assert.throws(()=>parseKalshi15mMarket({...marketInput(),rules_primary:''},time),
    /UNVERIFIED/);
  assert.throws(()=>parseKalshi15mMarket({...marketInput(),floor_strike:undefined},time),
    /UNVERIFIED/);
  assert.throws(()=>parseKalshi15mMarket({...marketInput(),strike_type:'less'},time),
    /UNVERIFIED/);
  assert.throws(()=>parseKalshi15mMarket({...marketInput(),status:'settled'},time),
    /UNVERIFIED/);
  assert.throws(()=>chooseKalshi15mMarket([marketInput(),marketInput()],time),
    /AMBIGUOUS_WINDOW/);
});

test('market discovery uses only public GET and refuses partial pagination',async()=>{
  const calls:string[]=[];
  const fetchImpl=(async (url:URL|string|Request, init?:RequestInit)=>{
    calls.push(String(url));
    assert.equal(init?.method,'GET');
    return new Response(JSON.stringify({markets:[marketInput()],cursor:''}),{status:200});
  }) as typeof fetch;
  const result=await fetchKalshi15mMarkets({fetchImpl,nowMs:closeAt-650_000});
  assert.equal(result.length,1);
  assert.equal(calls[0],'https://external-api.kalshi.com/trade-api/v2/markets?series_ticker=KXBTC15M&status=open&limit=200');
  await assert.rejects(()=>fetchKalshi15mMarkets({nowMs:closeAt-650_000,
    fetchImpl:(async()=>new Response(JSON.stringify({markets:[marketInput()],cursor:'MORE'}))) as typeof fetch}),/PAGINATION/);
  await assert.rejects(()=>fetchKalshi15mMarkets({nowMs:closeAt-650_000,baseUrl:'https://example.com'}),/FORBIDDEN/);
});

test('forecasts recorded only at their real preclose checkpoints with no backfill',async()=>{
  const entries:KalshiStudyReceipt[]=[];
  const session=new Kalshi15mStudySession(market(),{append:async r=>{entries.push(r);}});
  const checkpoint=closeAt-600_000;
  assert.equal(await session.checkpoint({nowMs:checkpoint-1}),null);
  assert.equal(session.ingest(book(checkpoint),checkpoint),'BOOK_READY');
  assert.equal(session.ingest(tick(checkpoint),checkpoint),'INDEX_READY');
  const receipt=await session.checkpoint({nowMs:checkpoint+1000,estimate:model(checkpoint),feeUsdPerContract:0.01});
  assert.equal(receipt?.direction,'UP');
  assert.equal(receipt?.paperOnly,true);
  assert.equal(receipt?.canSubmitOrders,false);
  assert.equal(receipt?.horizonSeconds,600);
  assert.equal(receipt?.baselineDirection,'UP');
  assert.equal(receipt?.settlementStatus,'PENDING');
  assert.equal(receipt?.officialOutcome,null);
  assert.ok(receipt?.observationHash);
  assert.equal(await session.checkpoint({nowMs:checkpoint+3000,estimate:model(checkpoint),feeUsdPerContract:0.01}),null);
  assert.equal(await session.checkpoint({nowMs:closeAt-300_000+6500}),null);
  assert.equal(entries.length,1);
});

test('no model => ABSTAIN (with explicitly uncalibrated naive direction)',async()=>{
  const entries:KalshiStudyReceipt[]=[];
  const session=new Kalshi15mStudySession(market(),{append:async r=>{entries.push(r);}});
  const at=closeAt-300_000;
  session.ingest(book(at),at);
  session.ingest(tick(at),at);
  const r=await session.checkpoint({nowMs:at+1_000});
  assert.equal(r?.direction,'ABSTAIN');
  assert.equal(r?.baselineDirection,'UP');
  assert.equal(r?.independentProbabilityUp,null);
  assert.equal(r?.netEdgeUsd,null);
  assert.equal(entries[0]?.reason,'INDEPENDENT_ESTIMATE_REQUIRED');
});

test('unfresh price => no synthetic forecast, not even baseline',async()=>{
  const entries:KalshiStudyReceipt[]=[];
  const session=new Kalshi15mStudySession(market(),{append:async r=>{entries.push(r);}});
  const at=closeAt-60_000;
  const r=await session.checkpoint({nowMs:at});
  assert.equal(r?.baselineDirection,null);
  assert.equal(r?.direction,'ABSTAIN');
  assert.equal(r?.reason,'MARKET_REFERENCE_OR_BOOK_NOT_READY');
});

test('store rejects tampering and duplicates on restart; produces Drive-safe rows',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'kalshi-study-'));
  const path=join(dir,'receipt.jsonl');
  try {
    const store=await KalshiStudyJsonlStore.open(path);
    const session=new Kalshi15mStudySession(market(),store);
    const at=closeAt-600_000;
    session.ingest(book(at),at);session.ingest(tick(at),at);
    const receipt=await session.checkpoint({nowMs:at,estimate:model(at),feeUsdPerContract:0.01});
    assert.ok(receipt);
    assert.equal((await readFile(path,'utf8')).split('\n').filter(Boolean).length,1);
    const loaded=await KalshiStudyJsonlStore.open(path);
    assert.equal(loaded.has(receipt!.id),true);
    await assert.rejects(()=>loaded.append(receipt!),/DUPLICATE/);
    const rows=kalshiStudySheetRows([receipt!]);
    assert.equal(rows[1]![14],'');
    assert.equal(rows[1]![16],'PENDING');
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('on storage failure, future predictions halt instead of silently claiming persistence',async()=>{
  const session=new Kalshi15mStudySession(market(),{
    append:async()=>{throw new Error('DISK_DOWN');},
  });
  await assert.rejects(()=>session.checkpoint({nowMs:closeAt-600_000}),/DISK_DOWN/);
  await assert.rejects(()=>session.checkpoint({nowMs:closeAt-300_000}),/SINK_FAILED/);
});
