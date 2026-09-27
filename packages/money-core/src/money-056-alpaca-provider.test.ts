import test from 'node:test'
import assert from 'node:assert/strict'
import { ALPACA_LIVE_BASE_URL,ALPACA_PAPER_BASE_URL,AlpacaManualLiveBrokerAdapter,AlpacaTradingApiClient,createAlpacaLiveAdapter,createAlpacaPaperBrokerAdapter,createAlpacaPaperClient } from './alpaca-trading-adapter.js'
import type { HttpClient } from './read-only-http-bank-adapter.js'

function fakeFetch(log:{url:string;headers:Headers;method:string;body?:string}[]):HttpClient{return async(input,init)=>{const url=String(input),headers=new Headers(init?.headers);log.push({url,headers,method:init?.method??'GET',body:typeof init?.body==='string'?init.body:undefined});if(url.endsWith('/v2/account'))return new Response(JSON.stringify({id:'acct1',currency:'USD',cash:'1000.00',buying_power:'1000.00'}),{status:200,headers:{'X-Request-ID':'req-account'}});if(url.endsWith('/v2/positions'))return new Response(JSON.stringify([{symbol:'AAPL',qty:'2',market_value:'400.00'}]),{status:200,headers:{'X-Request-ID':'req-pos'}});if(url.includes('/v2/orders:by_client_order_id'))return new Response(JSON.stringify({id:'order1',client_order_id:'cid1',status:'filled'}),{status:200,headers:{'X-Request-ID':'req-order'}});if(init?.method==='DELETE')return new Response(null,{status:204,headers:{'X-Request-ID':'req-cancel'}});if(url.endsWith('/v2/orders')&&init?.method==='POST')return new Response(JSON.stringify({id:'order1',client_order_id:'cid1',status:'accepted',submitted_at:'2026-09-20T18:00:00Z'}),{status:200,headers:{'X-Request-ID':'req-submit'}});return new Response('{}',{status:404,headers:{'X-Request-ID':'req-404'}})}}
const credentials=()=>({keyId:'key',secretKey:'secret'})

test('056.1 paper and live domains are hard separated',()=>{const paper=createAlpacaPaperClient({credentials,fetchImpl:fakeFetch([])});assert.equal(paper.baseUrl,ALPACA_PAPER_BASE_URL);const live=createAlpacaLiveAdapter({credentials,fetchImpl:fakeFetch([]),liveTradingEnabled:false});assert.equal((live as any).client.baseUrl,ALPACA_LIVE_BASE_URL);assert.throws(()=>new AlpacaManualLiveBrokerAdapter(paper,false),/LIVE_CLIENT_REQUIRED/)})
test('056.2 Alpaca credentials stay in provider headers and account binding is exact',async()=>{const log:any[]=[];const c=createAlpacaPaperClient({credentials,fetchImpl:fakeFetch(log)}),a=await c.getAccount('acct1','2026-09-20T18:00:00Z');assert.equal(a.cashMinor,100000n);assert.equal(log[0].headers.get('apca-api-key-id'),'key');assert.equal(log[0].headers.get('apca-api-secret-key'),'secret');await assert.rejects(()=>c.getAccount('other','2026-09-20T18:00:00Z'),/ACCOUNT_BINDING/)})
test('056.3 positions normalize to canonical stock instrument ids',async()=>{const p=await createAlpacaPaperClient({credentials,fetchImpl:fakeFetch([])}).listPositions('acct1','2026-09-20T18:00:00Z');assert.deepEqual(p.map(x=>[x.instrumentId,x.quantity,x.marketValueMinor]),[['stock:AAPL','2',40000n]])})
test('056.4 live submit is disabled unless explicitly enabled',async()=>{const live=createAlpacaLiveAdapter({credentials,fetchImpl:fakeFetch([]),liveTradingEnabled:false});await assert.rejects(()=>live.submitOrder({environment:'LIVE',executionId:'e1',idempotencyKey:'cid1',actionFingerprint:'fp',permitId:'p',userId:'u',manualTriggerId:'click',now:'2026-09-20T18:00:00Z'},{clientOrderId:'cid1',accountId:'acct1',instrumentId:'stock:AAPL',side:'BUY',orderType:'LIMIT',notionalMinor:'100000',limitPriceMinor:'20000',currency:'USD',timeInForce:'DAY'}),/LIVE_DISABLED/)})
test('056.5 enabled live submit maps approved notional to a bounded fractional limit quantity',async()=>{const log:any[]=[];const live=createAlpacaLiveAdapter({credentials,fetchImpl:fakeFetch(log),liveTradingEnabled:true}),r=await live.submitOrder({environment:'LIVE',executionId:'e1',idempotencyKey:'cid1',actionFingerprint:'fp',permitId:'p',userId:'u',manualTriggerId:'click',now:'2026-09-20T18:00:00Z'},{clientOrderId:'cid1',accountId:'acct1',instrumentId:'stock:AAPL',side:'BUY',orderType:'LIMIT',notionalMinor:'100000',limitPriceMinor:'20000',currency:'USD',timeInForce:'DAY'});assert.equal(r.state,'ACKNOWLEDGED');const body=JSON.parse(log.at(-1).body);assert.equal(body.symbol,'AAPL');assert.equal(body.qty,'5');assert.equal(body.limit_price,'200.00');assert.equal(body.client_order_id,'cid1');assert.equal(body.extended_hours,false)})
test('056.6 forex is not silently routed through the equity broker',async()=>{const live=createAlpacaLiveAdapter({credentials,fetchImpl:fakeFetch([]),liveTradingEnabled:true});await assert.rejects(()=>live.submitOrder({environment:'LIVE',executionId:'e1',idempotencyKey:'cid1',actionFingerprint:'fp',permitId:'p',userId:'u',manualTriggerId:'click',now:'2026-09-20T18:00:00Z'},{clientOrderId:'cid1',accountId:'acct1',instrumentId:'forex:EURUSD',side:'BUY',orderType:'LIMIT',notionalMinor:'100000',limitPriceMinor:'100',currency:'USD',timeInForce:'DAY'}),/INSTRUMENT_UNSUPPORTED/)})
test('056.7 order lookup and cancellation remain read/reconcile safe',async()=>{const c=new AlpacaTradingApiClient('LIVE',{mode:'LIVE',credentials,fetchImpl:fakeFetch([])}),o=await c.getOrder(undefined,'cid1','2026-09-20T18:00:00Z');assert.equal(o.state,'FILLED');const cancel=await c.cancelOrder('order1','2026-09-20T18:00:01Z');assert.equal(cancel.state,'PENDING')})

test('056.8 paper broker requires the paper autopilot gate and can never claim live authority',async()=>{
 const log:any[]=[]
 const paper=createAlpacaPaperBrokerAdapter({credentials,fetchImpl:fakeFetch(log)})
 const request={clientOrderId:'paper-cid1',accountId:'acct1',instrumentId:'stock:AAPL',side:'BUY' as const,orderType:'LIMIT' as const,notionalMinor:'100000',limitPriceMinor:'20000',currency:'USD',timeInForce:'DAY' as const}
 const blocked={mode:'ADVISE' as const,disposition:'ADVISE_ONLY' as const,reasonCodes:['ADVISE_MODE'],notionalMultiplierBps:0,authority:'PAPER_ONLY' as const,canAuthorizeLive:false as const}
 await assert.rejects(()=>paper.submitPaperOrder({environment:'PAPER',executionId:'paper-e0',idempotencyKey:'paper-cid0',userId:'u',paperRunId:'run1',paperDecisionId:'d0',now:'2026-09-20T18:00:00Z',autopilot:blocked},request),/AUTOPILOT_GATE_REQUIRED/)
 const allowed={mode:'PAPER_AUTO_REDUCED' as const,disposition:'PAPER_TRADE_ELIGIBLE' as const,reasonCodes:['REDUCED_PAPER_SIZE'],notionalMultiplierBps:2500,authority:'PAPER_ONLY' as const,canAuthorizeLive:false as const}
 const result=await paper.submitPaperOrder({environment:'PAPER',executionId:'paper-e1',idempotencyKey:'paper-cid1',userId:'u',paperRunId:'run1',paperDecisionId:'d1',now:'2026-09-20T18:00:00Z',autopilot:allowed},request)
 assert.equal(result.environment,'PAPER')
 assert.equal(result.authority,'PAPER_ONLY')
 assert.equal(result.canAuthorizeLive,false)
 assert.ok(log.at(-1).url.startsWith(ALPACA_PAPER_BASE_URL))
})

test('056.9 paper bracket order binds stop-loss and take-profit to the entry',async()=>{
 const log:any[]=[]
 const paper=createAlpacaPaperBrokerAdapter({credentials,fetchImpl:fakeFetch(log)})
 const allowed={mode:'PAPER_AUTO_REDUCED' as const,disposition:'PAPER_TRADE_ELIGIBLE' as const,reasonCodes:['REDUCED_PAPER_SIZE'],notionalMultiplierBps:2500,authority:'PAPER_ONLY' as const,canAuthorizeLive:false as const}
 const result=await paper.submitPaperOrder(
  {environment:'PAPER',executionId:'paper-bracket-e1',idempotencyKey:'paper-bracket-cid1',userId:'u',paperRunId:'run-bracket',paperDecisionId:'d-bracket',now:'2026-09-20T18:00:00Z',autopilot:allowed},
  {clientOrderId:'paper-bracket-cid1',accountId:'acct1',instrumentId:'stock:AAPL',side:'BUY',orderType:'LIMIT',notionalMinor:'100000',limitPriceMinor:'20000',currency:'USD',timeInForce:'DAY',takeProfitPriceMinor:'20800',stopLossPriceMinor:'19600'}
 )
 assert.equal(result.environment,'PAPER')
 const body=JSON.parse(log.at(-1).init.body)
 assert.equal(body.order_class,'bracket')
 assert.equal(body.take_profit.limit_price,'208.00')
 assert.equal(body.stop_loss.stop_price,'196.00')
})

test('056.10 malformed paper bracket is rejected before provider submission',async()=>{
 const paper=createAlpacaPaperBrokerAdapter({credentials,fetchImpl:fakeFetch([])})
 const allowed={mode:'PAPER_AUTO_REDUCED' as const,disposition:'PAPER_TRADE_ELIGIBLE' as const,reasonCodes:['REDUCED_PAPER_SIZE'],notionalMultiplierBps:2500,authority:'PAPER_ONLY' as const,canAuthorizeLive:false as const}
 await assert.rejects(
  ()=>paper.submitPaperOrder(
   {environment:'PAPER',executionId:'e',idempotencyKey:'c',userId:'u',paperRunId:'r',paperDecisionId:'d',now:'2026-09-20T18:00:00Z',autopilot:allowed},
   {clientOrderId:'c',accountId:'acct1',instrumentId:'stock:AAPL',side:'BUY',orderType:'LIMIT',notionalMinor:'100000',limitPriceMinor:'20000',currency:'USD',timeInForce:'DAY',takeProfitPriceMinor:'19000',stopLossPriceMinor:'19600'}
  ),
  /MONEY_ALPACA_LONG_BRACKET_ORDER_INVALID/
 )
})
