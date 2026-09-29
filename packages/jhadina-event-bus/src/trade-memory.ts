import type { EventBus, RuntimeEventContext } from './index'
import { TradeEventSequenceGuard, subscribeTradeStream, type TradeEventType, type TradeLeg, type TradeStreamEvent } from './trade-events'

export type TradeMemoryEvent=Readonly<{
  id:string
  type:TradeEventType
  occurredAt:string
  leg:TradeLeg
  evidenceIds:readonly string[]
  details:Readonly<Record<string,unknown>>
  context:RuntimeEventContext
}>

export type TradeMemoryRecord=Readonly<{
  tradeId:string
  runLineageId:string
  strategyId:string
  instrumentId:string
  tokenAddress?:string
  discoveredAt:string
  sharkAnalysis?:TradeMemoryEvent
  thesis?:TradeMemoryEvent
  entryRiskApproval?:TradeMemoryEvent
  entryOrderIntent?:TradeMemoryEvent
  entryFill?:TradeMemoryEvent
  latestPositionState?:TradeMemoryEvent
  exitRiskApproval?:TradeMemoryEvent
  exitOrderIntent?:TradeMemoryEvent
  exitFill?:TradeMemoryEvent
  exited?:TradeMemoryEvent
  review?:TradeMemoryEvent
  events:readonly TradeMemoryEvent[]
  evidenceIds:readonly string[]
  updatedAt:string
  authority:'SHARED_TRADE_MEMORY'
}>

type MutableTradeMemoryRecord={-readonly [K in keyof TradeMemoryRecord]:TradeMemoryRecord[K]}

export interface TradeMemoryStore{
  get(tradeId:string):Promise<TradeMemoryRecord|undefined>|TradeMemoryRecord|undefined
  put(record:TradeMemoryRecord):Promise<void>|void
}

export class InMemoryTradeMemoryStore implements TradeMemoryStore{
  private readonly rows=new Map<string,TradeMemoryRecord>()
  get(tradeId:string):TradeMemoryRecord|undefined{return this.rows.get(tradeId)}
  put(record:TradeMemoryRecord):void{this.rows.set(record.tradeId,record)}
  list():readonly TradeMemoryRecord[]{return Object.freeze([...this.rows.values()])}
}

function memoryEvent(event:TradeStreamEvent):TradeMemoryEvent{
  if(!event.context)throw new Error('TRADE_MEMORY_CONTEXT_REQUIRED')
  return Object.freeze({
    id:event.id,
    type:event.type,
    occurredAt:event.occurredAt,
    leg:event.payload.leg,
    evidenceIds:Object.freeze([...event.payload.evidenceIds]),
    details:Object.freeze({...event.payload.details}),
    context:Object.freeze({...event.context}),
  })
}

function restoreEvent(record:TradeMemoryRecord,event:TradeMemoryEvent):TradeStreamEvent{
  return Object.freeze({
    id:event.id,
    type:event.type,
    occurredAt:event.occurredAt,
    payload:Object.freeze({
      tradeId:record.tradeId,
      runLineageId:record.runLineageId,
      strategyId:record.strategyId,
      instrumentId:record.instrumentId,
      tokenAddress:record.tokenAddress,
      leg:event.leg,
      evidenceIds:event.evidenceIds,
      details:event.details,
    }),
    context:event.context,
  })
}

export class TradeMemoryProjector{
  constructor(private readonly store:TradeMemoryStore){}

  async handle(event:TradeStreamEvent):Promise<TradeMemoryRecord>{
    const current=await this.store.get(event.payload.tradeId)
    if(current?.events.some(item=>item.id===event.id))return current

    if(current){
      if(
        current.runLineageId!==event.payload.runLineageId||
        current.strategyId!==event.payload.strategyId||
        current.instrumentId!==event.payload.instrumentId
      )throw new Error('TRADE_MEMORY_LINEAGE_MISMATCH')
    }

    const guard=new TradeEventSequenceGuard()
    for(const prior of current?.events??[])guard.accept(restoreEvent(current!,prior))
    guard.accept(event)

    const item=memoryEvent(event)
    const base:TradeMemoryRecord=current??Object.freeze({
      tradeId:event.payload.tradeId,
      runLineageId:event.payload.runLineageId,
      strategyId:event.payload.strategyId,
      instrumentId:event.payload.instrumentId,
      tokenAddress:event.payload.tokenAddress,
      discoveredAt:event.occurredAt,
      events:Object.freeze([]),
      evidenceIds:Object.freeze([]),
      updatedAt:event.occurredAt,
      authority:'SHARED_TRADE_MEMORY' as const,
    })

    const next:MutableTradeMemoryRecord={
      ...base,
      tokenAddress:base.tokenAddress??event.payload.tokenAddress,
      events:Object.freeze([...base.events,item]),
      evidenceIds:Object.freeze([...new Set([...base.evidenceIds,...event.payload.evidenceIds])]),
      updatedAt:event.occurredAt,
      authority:'SHARED_TRADE_MEMORY',
    }

    if(event.type==='SHARK_ANALYZED')next.sharkAnalysis=item
    if(event.type==='THESIS_CREATED')next.thesis=item
    if(event.type==='RISK_APPROVED'&&event.payload.leg==='ENTRY')next.entryRiskApproval=item
    if(event.type==='ORDER_INTENT_CREATED'&&event.payload.leg==='ENTRY')next.entryOrderIntent=item
    if(event.type==='FILLED'&&event.payload.leg==='ENTRY')next.entryFill=item
    if(event.type==='POSITION_MONITORED')next.latestPositionState=item
    if(event.type==='RISK_APPROVED'&&event.payload.leg==='EXIT')next.exitRiskApproval=item
    if(event.type==='ORDER_INTENT_CREATED'&&event.payload.leg==='EXIT')next.exitOrderIntent=item
    if(event.type==='FILLED'&&event.payload.leg==='EXIT')next.exitFill=item
    if(event.type==='EXITED')next.exited=item
    if(event.type==='TRADE_REVIEWED')next.review=item

    const frozen=Object.freeze(next) as TradeMemoryRecord
    await this.store.put(frozen)
    return frozen
  }
}

export function attachTradeMemoryProjection(bus:EventBus,store:TradeMemoryStore):()=>void{
  const projector=new TradeMemoryProjector(store)
  return subscribeTradeStream(bus,event=>projector.handle(event).then(()=>undefined))
}

export interface TradeMemoryDatabaseError{code?:string;message:string}
export interface TradeMemoryDatabaseClient{
  from(table:string):{
    upsert(values:Record<string,unknown>,options:{onConflict:string}):PromiseLike<{error:TradeMemoryDatabaseError|null}>
    select(columns:string):{
      eq(column:string,value:string):{
        maybeSingle():PromiseLike<{data:Record<string,unknown>|null;error:TradeMemoryDatabaseError|null}>
      }
    }
  }
}

export class SupabaseTradeMemoryStore implements TradeMemoryStore{
  constructor(private readonly db:TradeMemoryDatabaseClient){}

  async get(tradeId:string):Promise<TradeMemoryRecord|undefined>{
    const {data,error}=await this.db.from('jhadina_trade_memory_records')
      .select('record').eq('trade_id',tradeId).maybeSingle()
    if(error)throw new Error('TRADE_MEMORY_READ_FAILED:'+error.message)
    if(!data)return undefined
    const record=data.record
    if(!record||typeof record!=='object')throw new Error('TRADE_MEMORY_CORRUPT')
    return record as TradeMemoryRecord
  }

  async put(record:TradeMemoryRecord):Promise<void>{
    const {error}=await this.db.from('jhadina_trade_memory_records').upsert({
      trade_id:record.tradeId,
      run_lineage_id:record.runLineageId,
      strategy_id:record.strategyId,
      instrument_id:record.instrumentId,
      record,
      updated_at:record.updatedAt,
    },{onConflict:'trade_id'})
    if(error)throw new Error('TRADE_MEMORY_WRITE_FAILED:'+error.message)
  }
}
