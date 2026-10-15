/**
 * Zero-credential, READ-ONLY scheduled research.
 * GitHub Actions runner creates one short-lived evidence artifact per run.
 * NOT a financial model, live feed, execution bot, or settlement record.
 */
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

export const BASE='https://external-api.kalshi.com/trade-api/v2';
export const SERIES='KXBTC15M';

function digest(object) {
  return createHash('sha256').update(JSON.stringify(object)).digest('hex');
}
function isObj(x) {return !!x&&typeof x==='object'&&!Array.isArray(x);}
function decimal(x) {
  if(typeof x!=='string'||!/^[0-9]+(?:[.][0-9]+)?$/.test(x))return null;
  const n=Number(x);
  return Number.isFinite(n)&&n>=0&&n<=1?n:null;
}
function validMarket(m,nowMs){
  if(!isObj(m)||typeof m.ticker!=='string'||!/^KXBTC15M-[A-Za-z0-9-]+$/.test(m.ticker)||
     (m.status!=='open'&&m.status!=='active')||typeof m.event_ticker!=='string'||
     !m.event_ticker.startsWith('KXBTC15M-')||
     (m.strike_type!=='greater'&&m.strike_type!=='greater_or_equal')||
     typeof m.floor_strike!=='number'||!Number.isFinite(m.floor_strike)||m.floor_strike<=0||
     typeof m.rules_primary!=='string'||m.rules_primary.trim().length===0)return false;
  const close=Date.parse(m.close_time);
  return Number.isFinite(close)&&close-nowMs>=120_000&&close-nowMs<=900_000;
}

export async function collectKalshiOpenMarkets(fetcher=fetch) {
  const markets=[];let cursor='';
  for(let page=0;page<5;page++){
    const path='/markets?series_ticker='+SERIES+'&status=open&limit=200'+
      (cursor?'&cursor='+encodeURIComponent(cursor):'');
    const response=await fetcher(BASE+path,{
      method:'GET',headers:{Accept:'application/json'},
      signal:AbortSignal.timeout(10_000),
    });
    if(!response.ok)throw new Error('KALSHI_HTTP_'+response.status);
    const body=await response.json();
    if(!isObj(body)||!Array.isArray(body.markets))throw new Error('KALSHI_RESPONSE_INVALID');
    markets.push(...body.markets);
    cursor=typeof body.cursor==='string'?body.cursor:'';
    if(!cursor)return markets;
  }
  throw new Error('KALSHI_MARKET_PAGINATION_INCOMPLETE');
}

/**
 * On each wake, record only the current market snapshot.
 * No independent model, execution cost, BTC feed or venue orderbook access
 * is claimed. Market-side guess is only a quote proxy.
 */
export function observeMarket(markets,atMs){
  if(!Number.isFinite(atMs))throw new Error('INVALID_CLOCK');
  const candidates=markets.filter(m=>validMarket(m,atMs))
    .sort((a,b)=>Date.parse(a.close_time)-Date.parse(b.close_time));
  const m=candidates[0];
  const base={
    schema:'JHADINA_GHA_BTC15M_V1',
    observed_at:new Date(atMs).toISOString(),
    status:m?'OBSERVED':'NOT_OBSERVED',
    authority:'PAPER_ONLY',canSubmitOrders:false,
    source:BASE+'/markets?series_ticker='+SERIES+'&status=open',
    market_ticker:m?.ticker??null,
    event_ticker:m?.event_ticker??null,
    close_at:m?.close_time??null,
    target_usd:m?.floor_strike??null,
    rules_primary:m?.rules_primary??null,
    strike_type:m?.strike_type??null,
    yes_bid_usd:null,no_bid_usd:null,
    baseline_direction:'ABSTAIN',
    model:'VENUE_BID_PROXY_NOT_INDEPENDENT',
    independent_probability_up:null,
    official_outcome:null,
    grading_status:'NOT_GRADED',
    reason:m?'BOOK_QUOTES_NOT_VALIDATED':'NO_ELIGIBLE_MARKET',
    market_sha256:m?digest(m):null,
  };
  if(m){
    const yes=decimal(m.yes_bid_dollars),no=decimal(m.no_bid_dollars);
    if(yes!==null&&no!==null&&yes>0&&no>0){
      base.yes_bid_usd=yes;
      base.no_bid_usd=no;
      base.baseline_direction=yes>no?'UP':yes<no?'DOWN':'ABSTAIN';
      base.reason='VENUE_BID_ONLY_UNCALIBRATED';
    }
  }
  return Object.freeze({...base,receipt_sha256:digest(base)});
}
export async function run(args={}){
  const fetcher=args.fetcher??fetch;
  const now=args.now??Date.now;
  const outDir=args.outputDir??'output/jhadina-btc15m';
  // Time is sampled AFTER network latency, never backdated.
  let receipt;
  try{
    const markets=await collectKalshiOpenMarkets(fetcher);
    receipt=observeMarket(markets,now());
  }catch(error){
    const at=now(),reason=error instanceof Error?error.message:'UNKNOWN_ERROR';
    const failure={schema:'JHADINA_GHA_BTC15M_V1',
      observed_at:new Date(at).toISOString(),status:'SOURCE_ERROR',
      authority:'PAPER_ONLY',canSubmitOrders:false,
      reason:/^KALSHI_[A-Z0-9_]+$/.test(reason)?reason:'SOURCE_UNAVAILABLE',
      independent_probability_up:null,official_outcome:null,grading_status:'NOT_GRADED'};
    receipt={...failure,receipt_sha256:digest(failure)};
  }
  const filename=receipt.observed_at.replace(/[:.]/g,'-')+'-'+receipt.receipt_sha256.slice(0,12)+'.json';
  await mkdir(outDir,{recursive:true});
  await writeFile(join(outDir,filename),JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({status:receipt.status,ticker:receipt.market_ticker??null,
    baseline:receipt.baseline_direction??'ABSTAIN',artifact:filename}));
  return receipt;
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
  await run();
}
