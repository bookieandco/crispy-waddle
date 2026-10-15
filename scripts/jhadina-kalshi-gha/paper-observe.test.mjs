import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,readdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {collectKalshiOpenMarkets,observeMarket,run} from './paper-observe.mjs';

const start=Date.UTC(2026,9,14,12,0,0);
const mkMarket=(close=start+600_000)=>({
  ticker:'KXBTC15M-26OCT140810-10',
  event_ticker:'KXBTC15M-26OCT140810',status:'active',
  close_time:new Date(close).toISOString(),floor_strike:83531.59,
  strike_type:'greater',rules_primary:'Official BRTI comparison including tie',
  yes_bid_dollars:'0.6300',no_bid_dollars:'0.3400',
});
test('makes a paper-only quote-proxy guess without independent model or outcome',()=>{
  const record=observeMarket([mkMarket()],start);
  assert.equal(record.status,'OBSERVED');
  assert.equal(record.market_ticker,mkMarket().ticker);
  assert.equal(record.baseline_direction,'UP');
  assert.equal(record.model,'VENUE_BID_PROXY_NOT_INDEPENDENT');
  assert.equal(record.independent_probability_up,null);
  assert.equal(record.official_outcome,null);
  assert.equal(record.canSubmitOrders,false);
  assert.match(record.receipt_sha256,/^[0-9a-f]{64}$/);
});
test('does not backdate or fabricate a late market prediction',()=>{
  assert.equal(observeMarket([mkMarket()],start+550_000).status,'NOT_OBSERVED');
  assert.equal(observeMarket([],start).baseline_direction,'ABSTAIN');
});
test('missing prices cause ABSTAIN, not implied 50/50 price',()=>{
  const r=observeMarket([{...mkMarket(),yes_bid_dollars:'',no_bid_dollars:'0.3500'}],start);
  assert.equal(r.status,'OBSERVED');
  assert.equal(r.baseline_direction,'ABSTAIN');
  assert.equal(r.yes_bid_usd,null);
});
test('requires exact market ticker, strike and venue rules',()=>{
  for(const invalid of [
    {...mkMarket(),ticker:'KXBTC15M-FAKE?this-is-not-good'},
    {...mkMarket(),floor_strike:undefined},
    {...mkMarket(),rules_primary:''},
    {...mkMarket(),strike_type:'range'},
  ]){
    assert.equal(observeMarket([invalid],start).status,'NOT_OBSERVED');
  }
});
test('GET market discovery handles bounded pagination and refuses partial catalogs',async()=>{
  let calls=0;
  const fetcher=async(url,options)=>{
    calls++;
    assert.equal(options.method,'GET');
    assert.ok(url.includes('series_ticker=KXBTC15M'));
    return new Response(JSON.stringify(calls===1?
      {markets:[],cursor:'next'}:{markets:[mkMarket()],cursor:''}),{status:200});
  };
  const found=await collectKalshiOpenMarkets(fetcher);
  assert.equal(calls,2);
  assert.equal(found.length,1);
  await assert.rejects(()=>collectKalshiOpenMarkets(async()=>new Response('oops',{status:502})),
    /KALSHI_HTTP_502/);
});
test('runner records API outage as SOURCE_ERROR and creates reviewable JSON',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'jhadina-gha-'));
  try{
    const rec=await run({now:()=>start,fetcher:async()=>{throw new Error('oops secret');},outputDir:dir});
    assert.equal(rec.status,'SOURCE_ERROR');
    assert.equal(rec.reason,'SOURCE_UNAVAILABLE');
    const files=await readdir(dir);
    assert.equal(files.length,1);
    const stored=JSON.parse(await readFile(join(dir,files[0]),'utf8'));
    assert.equal(stored.receipt_sha256,rec.receipt_sha256);
    assert.equal(stored.official_outcome,null);
  }finally{await rm(dir,{recursive:true,force:true});}
});
