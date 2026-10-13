import assert from 'node:assert/strict';
import test from 'node:test';
import {Kalshi15mFastPaper} from './kalshi-15m-fast-paper.js';

const ticker = 'KXBTC15M-26OCT130230';
const now = 950_000;
const base = () => new Kalshi15mFastPaper({
  marketTicker:ticker, targetUsd:83531.59, closeAtMs:1_000_000,
});
const book = (seq = 1, tickerOverride = ticker) => ({
  type:'orderbook_snapshot', sid:8, seq, sending_ts_ms:now,
  msg:{market_ticker:tickerOverride, yes_dollars_fp:[['0.9300','20.00']],
    no_dollars_fp:[['0.0600','25.00']]},
});
const tick = (sourceTime = now, seq = 1) => ({
  type:'cfbenchmarks_value', sid:12, seq, sending_ts_ms:sourceTime,
  msg:{index_id:'BRTI', data:JSON.stringify({type:'value', id:'BRTI',
    time:sourceTime, value:'83603.89'})},
});
const model = (probabilityUp = 0.99, observedAtMs = now) => ({
  marketTicker:ticker, probabilityUp, observedAtMs,
  modelId:'test-independent-v1', evidenceIds:['test:synthetic'],
});
function ready() {
  const engine=base();
  assert.equal(engine.ingest(book(),now),'BOOK_READY');
  assert.equal(engine.ingest(tick(),now),'INDEX_READY');
  return engine;
}

test('replays screenshot-like reference-price gap without inferring UNDER from downward trend',()=>{
  const engine=ready();
  const snapshot=engine.snapshot(now);
  assert.equal(snapshot.deltaFromTargetUsd,72.30000000000291);
  assert.equal(snapshot.bookFresh,true);
  assert.equal(snapshot.indexFresh,true);
  assert.ok(Math.abs((snapshot.upAskUsd ?? 0)-0.94)<1e-10);
  assert.ok(Math.abs((snapshot.downAskUsd ?? 0)-0.07)<1e-10);
});

test('no independent estimate or fee proof means NO_TRADE',()=>{
  const engine=ready();
  assert.equal(engine.decide({nowMs:now,feeUsdPerContract:0.01}).reason,'INDEPENDENT_ESTIMATE_REQUIRED');
  assert.equal(engine.decide({nowMs:now,estimate:model()}).reason,'EXECUTION_COSTS_REQUIRED');
});

test('fee-aware paper edge is never an order or live authority',()=>{
  const decision=ready().decide({nowMs:now,estimate:model(),feeUsdPerContract:0.01});
  assert.equal(decision.action,'PAPER_CANDIDATE');
  assert.equal(decision.side,'UP');
  assert.equal(decision.canSubmitOrders,false);
  assert.equal(decision.authority,'PAPER_ONLY');
  assert.ok(Math.abs((decision.estimatedNetEdgeUsd ?? 0)-0.04)<1e-10);
});

test('stale reference tick and stale model both block paper action',()=>{
  const engine=ready();
  assert.equal(engine.decide({nowMs:now+3_000,estimate:model(now===0?1:0.99,now+3_000),feeUsdPerContract:0.01}).reason,'STALE_OR_MISSING_FEED');
  assert.equal(engine.decide({nowMs:now,estimate:model(0.99,now-3_000),feeUsdPerContract:0.01}).reason,'STALE_ESTIMATE');
});

test('out-of-order index tick cannot replace last good source observation',()=>{
  const engine=ready();
  assert.equal(engine.ingest(tick(now-100,1),now+100),'IGNORED');
  assert.equal(engine.snapshot(now+100).indexUsd,83603.89);
});

test('book sequence gap rejects all decisions until resnapshot',()=>{
  const engine=ready();
  assert.equal(engine.ingest({
    type:'orderbook_delta',sid:8,seq:3,sending_ts_ms:now+100,
    msg:{market_ticker:ticker,side:'yes',price_dollars:'0.9300',delta_fp:'-1.00'},
  },now+100),'BOOK_RESNAPSHOT_REQUIRED');
  assert.equal(engine.decide({nowMs:now+100,estimate:model(0.99,now+100),feeUsdPerContract:0.01}).reason,'BOOK_NOT_SYNCHRONIZED');
  assert.equal(engine.ingest(book(4),now+100),'BOOK_READY');
  assert.equal(engine.decide({nowMs:now+100,estimate:model(0.99,now+100),feeUsdPerContract:0.01}).action,'PAPER_CANDIDATE');
});

test('bad book delta underflow fails closed',()=>{
  const engine=ready();
  assert.equal(engine.ingest({
    type:'orderbook_delta',sid:8,seq:2,sending_ts_ms:now+100,
    msg:{market_ticker:ticker,side:'yes',price_dollars:'0.9300',delta_fp:'-200.00'},
  },now+100),'BOOK_RESNAPSHOT_REQUIRED');
});

test('ignores other markets and wrong index IDs',()=>{
  const engine=base();
  assert.equal(engine.ingest(book(1,'OTHER-MARKET'),now),'IGNORED');
  assert.equal(engine.ingest({...tick(),msg:{index_id:'ETHUSD_RTI'}},now),'IGNORED');
  assert.equal(engine.decide({nowMs:now,estimate:model(),feeUsdPerContract:0.01}).action,'NO_TRADE');
});

test('minimum time to close and insufficient net edge block action',()=>{
  const engine=ready();
  assert.equal(engine.decide({nowMs:990_000,estimate:model(0.99,990_000),feeUsdPerContract:0.01}).reason,'TOO_CLOSE_TO_SETTLEMENT');
  assert.equal(engine.decide({nowMs:now,estimate:model(0.96),feeUsdPerContract:0.02}).reason,'NO_EVIDENCED_NET_EDGE');
});

test('buying DOWN requires independent edge, not simply a falling chart',()=>{
  const engine=ready();
  const decision=engine.decide({nowMs:now,estimate:model(0.01),feeUsdPerContract:0.01});
  assert.equal(decision.side,'DOWN');
  assert.equal(decision.authority,'PAPER_ONLY');
  assert.equal(decision.canSubmitOrders,false);
});
