import assert from 'node:assert/strict'
import test from 'node:test'
import type { CredentialResolver } from './credential-resolver.js'
import { FinnhubForexMarketDataAdapter,finnhubCandlesToMarketObservations } from './finnhub-forex-market-data.js'

const resolver:CredentialResolver={async resolve(){return{secret:'fixture'}}}

test('Finnhub forex adapter reads HTTPS evidence only',async()=>{
  const methods:string[]=[]
  const adapter=new FinnhubForexMarketDataAdapter({credentialResolver:resolver,fetchImpl:async(input,init)=>{
    methods.push(init?.method??'GET')
    const u=new URL(String(input))
    if(u.pathname.endsWith('/forex/exchange'))return new Response(JSON.stringify(['oanda','fxcm','oanda']),{status:200})
    if(u.pathname.endsWith('/forex/symbol'))return new Response(JSON.stringify([{symbol:'OANDA:EUR_USD'}]),{status:200})
    return new Response(JSON.stringify({s:'ok',t:[1790020800],o:[1.1],h:[1.2],l:[1],c:[1.15]}),{status:200})
  }})
  assert.deepEqual(await adapter.listExchanges('2026-09-22T02:00:00Z'),['fxcm','oanda'])
  assert.equal((await adapter.listSymbols('oanda','2026-09-22T02:00:00Z'))[0]?.symbol,'OANDA:EUR_USD')
  const candles=await adapter.getCandles({symbol:'OANDA:EUR_USD',resolution:'1',from:'2026-09-21T18:00:00Z',to:'2026-09-22T03:00:00Z',receivedAt:'2026-09-22T03:00:01Z'})
  assert.equal(candles[0]?.canExecute,false)
  assert.ok(methods.every(x=>x==='GET'))
  const rows=finnhubCandlesToMarketObservations({instrumentId:'forex:EURUSD',candles,receivedAt:'2026-09-22T03:00:01Z'})
  assert.equal(rows.length,4)
  assert.ok(rows.every(x=>x.qualityStatus==='VALID'))
})

test('Finnhub forex adapter fails closed on insecure or malformed data',async()=>{
  assert.throws(()=>new FinnhubForexMarketDataAdapter({credentialResolver:resolver,baseUrl:'http://invalid.local/'}),/HTTPS_REQUIRED/)
  const adapter=new FinnhubForexMarketDataAdapter({credentialResolver:resolver,fetchImpl:async()=>new Response(JSON.stringify({s:'ok',t:[1,2],o:[1],h:[1,1],l:[1,1],c:[1,1]}),{status:200})})
  await assert.rejects(()=>adapter.getCandles({symbol:'OANDA:EUR_USD',resolution:'D',from:'2026-09-01T00:00:00Z',to:'2026-09-20T00:00:00Z',receivedAt:'2026-09-20T00:00:01Z'}),/LENGTH_MISMATCH/)
})
