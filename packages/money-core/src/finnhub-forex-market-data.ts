import { createHash } from 'node:crypto'
import type { CredentialResolver } from './credential-resolver.js'
import type { HttpClient } from './read-only-http-bank-adapter.js'
import type { MarketObservationRecord } from './market-provenance-contracts.js'

export const FINNHUB_FOREX_PROVIDER='finnhub' as const
export const FINNHUB_API_BASE_URL='https://finnhub.io/api/v1/' as const

export type FinnhubForexSymbol=Readonly<{
  description?:string
  displaySymbol?:string
  symbol:string
}>

export type FinnhubForexCandlePayload=Readonly<{
  c?:readonly number[]
  h?:readonly number[]
  l?:readonly number[]
  o?:readonly number[]
  s?:string
  t?:readonly number[]
  v?:readonly number[]
}>

export type FinnhubForexCandle=Readonly<{
  symbol:string
  resolution:string
  openedAt:string
  availableAt:string
  open:string
  high:string
  low:string
  close:string
  volume?:string
  provider:'finnhub'
  evidenceRef:string
  provenanceHash:string
  authority:'EVIDENCE_ONLY'
  canExecute:false
}>

export interface FinnhubForexMarketData{
  readonly provider:'finnhub'
  listExchanges(now:string):Promise<readonly string[]>
  listSymbols(exchange:string,now:string):Promise<readonly FinnhubForexSymbol[]>
  getCandles(input:{symbol:string;resolution:string;from:string;to:string;receivedAt:string}):Promise<readonly FinnhubForexCandle[]>
}

export type FinnhubForexAdapterOptions=Readonly<{
  credentialResolver:CredentialResolver
  credentialRef?:string
  baseUrl?:string
  fetchImpl?:HttpClient
  timeoutMs?:number
  exchangePath?:string
  symbolPath?:string
  candlePath?:string
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const iso=(s:string,code:string)=>{if(Number.isNaN(Date.parse(s)))throw new Error(code)}
const nonEmpty=(s:string,code:string)=>{if(!s.trim())throw new Error(code)}
const numeric=(n:number,code:string)=>{if(!Number.isFinite(n))throw new Error(code);return String(n)}
const unix=(s:string)=>Math.floor(Date.parse(s)/1000)

export class FinnhubForexMarketDataAdapter implements FinnhubForexMarketData{
  readonly provider=FINNHUB_FOREX_PROVIDER
  private readonly baseUrl:string
  private readonly fetchImpl:HttpClient
  constructor(private readonly options:FinnhubForexAdapterOptions){
    this.baseUrl=options.baseUrl??FINNHUB_API_BASE_URL
    if(!/^https:\/\//i.test(this.baseUrl))throw new Error('MONEY_FINNHUB_HTTPS_REQUIRED')
    this.fetchImpl=options.fetchImpl??fetch
  }

  private async request(path:string,params:Record<string,string>,receivedAt:string):Promise<unknown>{
    iso(receivedAt,'MONEY_FINNHUB_RECEIVED_AT_INVALID')
    const {secret}=await this.options.credentialResolver.resolve(this.options.credentialRef??'money/finnhub/market-data')
    if(!secret.trim())throw new Error('MONEY_FINNHUB_TOKEN_REQUIRED')
    const url=new URL(path,this.baseUrl)
    for(const [k,v] of Object.entries(params))url.searchParams.set(k,v)
    url.searchParams.set('token',secret)
    const controller=new AbortController()
    const timeout=setTimeout(()=>controller.abort(),this.options.timeoutMs??10000)
    try{
      const response=await this.fetchImpl(url,{method:'GET',headers:{Accept:'application/json','X-Jhadina-Received-At':receivedAt},signal:controller.signal})
      if(!response.ok)throw new Error('MONEY_FINNHUB_HTTP_'+response.status)
      return await response.json()
    }finally{clearTimeout(timeout)}
  }

  async listExchanges(now:string):Promise<readonly string[]>{
    const payload=await this.request(this.options.exchangePath??'forex/exchange',{},now)
    if(!Array.isArray(payload))throw new Error('MONEY_FINNHUB_EXCHANGES_MALFORMED')
    const rows=payload.map(String).filter(x=>x.trim()).sort()
    return Object.freeze([...new Set(rows)])
  }

  async listSymbols(exchange:string,now:string):Promise<readonly FinnhubForexSymbol[]>{
    nonEmpty(exchange,'MONEY_FINNHUB_EXCHANGE_REQUIRED')
    const payload=await this.request(this.options.symbolPath??'forex/symbol',{exchange},now)
    if(!Array.isArray(payload))throw new Error('MONEY_FINNHUB_SYMBOLS_MALFORMED')
    return Object.freeze(payload.map((row:any)=>{
      const symbol=String(row?.symbol??'').trim()
      if(!symbol)throw new Error('MONEY_FINNHUB_SYMBOL_REQUIRED')
      return Object.freeze({symbol,description:row?.description?String(row.description):undefined,displaySymbol:row?.displaySymbol?String(row.displaySymbol):undefined})
    }))
  }

  async getCandles(input:{symbol:string;resolution:string;from:string;to:string;receivedAt:string}):Promise<readonly FinnhubForexCandle[]>{
    nonEmpty(input.symbol,'MONEY_FINNHUB_SYMBOL_REQUIRED')
    nonEmpty(input.resolution,'MONEY_FINNHUB_RESOLUTION_REQUIRED')
    iso(input.from,'MONEY_FINNHUB_FROM_INVALID');iso(input.to,'MONEY_FINNHUB_TO_INVALID');iso(input.receivedAt,'MONEY_FINNHUB_RECEIVED_AT_INVALID')
    if(Date.parse(input.to)<=Date.parse(input.from))throw new Error('MONEY_FINNHUB_RANGE_INVALID')
    const payload=await this.request(this.options.candlePath??'forex/candle',{symbol:input.symbol,resolution:input.resolution,from:String(unix(input.from)),to:String(unix(input.to))},input.receivedAt) as FinnhubForexCandlePayload
    if(payload.s==='no_data')return Object.freeze([])
    if(payload.s!=='ok')throw new Error('MONEY_FINNHUB_CANDLE_STATUS_INVALID')
    const arrays=[payload.o,payload.h,payload.l,payload.c,payload.t]
    if(arrays.some(x=>!Array.isArray(x)))throw new Error('MONEY_FINNHUB_CANDLES_MALFORMED')
    const n=payload.t!.length
    if([payload.o!,payload.h!,payload.l!,payload.c!].some(x=>x.length!==n)||(payload.v&&payload.v.length!==n))throw new Error('MONEY_FINNHUB_CANDLE_LENGTH_MISMATCH')
    const out:FinnhubForexCandle[]=[]
    for(let i=0;i<n;i++){
      const openedAt=new Date(payload.t![i]!*1000).toISOString()
      if(Date.parse(openedAt)>Date.parse(input.to))throw new Error('MONEY_FINNHUB_FUTURE_CANDLE')
      const values={open:numeric(payload.o![i]!,'MONEY_FINNHUB_OPEN_INVALID'),high:numeric(payload.h![i]!,'MONEY_FINNHUB_HIGH_INVALID'),low:numeric(payload.l![i]!,'MONEY_FINNHUB_LOW_INVALID'),close:numeric(payload.c![i]!,'MONEY_FINNHUB_CLOSE_INVALID')}
      const evidenceRef='finnhub:forex:candle:'+hash({symbol:input.symbol,resolution:input.resolution,openedAt,values})
      out.push(Object.freeze({symbol:input.symbol,resolution:input.resolution,openedAt,availableAt:input.receivedAt,...values,volume:payload.v?numeric(payload.v[i]!,'MONEY_FINNHUB_VOLUME_INVALID'):undefined,provider:'finnhub',evidenceRef,provenanceHash:hash({provider:'finnhub',symbol:input.symbol,resolution:input.resolution,openedAt,values}),authority:'EVIDENCE_ONLY',canExecute:false}))
    }
    return Object.freeze(out)
  }
}

export function finnhubCandlesToMarketObservations(input:{instrumentId:string;candles:readonly FinnhubForexCandle[];receivedAt:string}):readonly MarketObservationRecord[]{
  nonEmpty(input.instrumentId,'MONEY_FINNHUB_INSTRUMENT_REQUIRED');iso(input.receivedAt,'MONEY_FINNHUB_RECEIVED_AT_INVALID')
  const rows:MarketObservationRecord[]=[]
  for(const candle of input.candles){
    if(candle.authority!=='EVIDENCE_ONLY'||candle.canExecute!==false)throw new Error('MONEY_FINNHUB_AUTHORITY_FORBIDDEN')
    if(Date.parse(candle.availableAt)>Date.parse(input.receivedAt))throw new Error('MONEY_FINNHUB_FUTURE_AVAILABLE_AT')
    for(const [field,value] of Object.entries({open:candle.open,high:candle.high,low:candle.low,close:candle.close})){
      rows.push(Object.freeze({observationId:'finnhub:'+hash({instrumentId:input.instrumentId,evidence:candle.evidenceRef,field}),instrumentId:input.instrumentId,provider:'finnhub',observationType:'FX_CANDLE_'+field.toUpperCase(),value,observedAt:candle.openedAt,receivedAt:input.receivedAt,effectiveAt:candle.openedAt,availableAt:candle.availableAt,qualityStatus:'VALID',evidenceRef:candle.evidenceRef,provenanceHash:candle.provenanceHash}))
    }
  }
  return Object.freeze(rows)
}
