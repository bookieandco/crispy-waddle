import { createHash } from 'node:crypto'
import type { DomainEvent, EventBus, RuntimeEventContext } from './index.js'

export const TRADING_EVENT_SEQUENCE=Object.freeze([
 'TOKEN_DISCOVERED',
 'SHARK_ANALYZED',
 'THESIS_CREATED',
 'RISK_APPROVED',
 'ORDER_INTENT_CREATED',
 'TX_SIMULATED',
 'TX_SIGNED',
 'TX_SENT',
 'FILLED',
 'POSITION_MONITORED',
 'EXITED',
 'TRADE_REVIEWED',
] as const)

export type TradingEventType=(typeof TRADING_EVENT_SEQUENCE)[number]
export type TradeReferenceMap=Readonly<Partial<Record<TradingEventType,string>>>

export type TradeRecord=Readonly<{
 tradeId:string
 runLineageId:string
 userId:string
 strategyId:string
 instrumentId:string
 currentEvent:TradingEventType
 sequenceIndex:number
 eventIds:readonly string[]
 references:TradeReferenceMap
 evidenceIds:readonly string[]
 positionOpen:boolean
 completed:boolean
 createdAt:string
 updatedAt:string
 recordHash:string
 authority:'TRADE_MEMORY_ONLY'
 canAuthorizeTrade:false
}>

export type TradeEventDetails=Readonly<Record<string,string|number|boolean|null>>

export type TradeMemoryEventPayload=Readonly<{
 tradeId:string
 runLineageId:string
 userId:string
 strategyId:string
 instrumentId:string
 referenceId:string
 evidenceIds:readonly string[]
 details:TradeEventDetails
 record:TradeRecord
 authority:'TRADE_MEMORY_EVENT_ONLY'
 canAuthorizeTrade:false
}>

export type TradeLifecycleAppendInput=Readonly<{
 id:string
 type:TradingEventType
 occurredAt:string
 context:RuntimeEventContext
 tradeId:string
 runLineageId:string
 userId:string
 strategyId:string
 instrumentId:string
 referenceId:string
 evidenceIds:readonly string[]
 details?:TradeEventDetails
}>

export interface TradeLifecycleRecorder{
 record(input:TradeLifecycleAppendInput):Promise<TradeRecord>
 get(tradeId:string):TradeRecord|undefined
}

function iso(value:string,code:string):void{
 if(!value.trim()||Number.isNaN(Date.parse(value)))throw new Error(code)
}
function required(value:string,code:string):void{
 if(!value.trim())throw new Error(code)
}
function hash(value:unknown):string{
 return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}
function unique(values:readonly string[]):readonly string[]{
 return Object.freeze([...new Set(values)].sort())
}
function indexOf(type:TradingEventType):number{return TRADING_EVENT_SEQUENCE.indexOf(type)}

function coreRecord(input:{
 previous?:TradeRecord
 eventId:string
 type:TradingEventType
 occurredAt:string
 tradeId:string
 runLineageId:string
 userId:string
 strategyId:string
 instrumentId:string
 referenceId:string
 evidenceIds:readonly string[]
}):Omit<TradeRecord,'recordHash'>{
 const p=input.previous
 const index=indexOf(input.type)
 if(index<0)throw new Error('TRADE_MEMORY_EVENT_TYPE_INVALID')
 if(!p){
  if(index!==0)throw new Error('TRADE_MEMORY_SEQUENCE_MUST_START_WITH_TOKEN_DISCOVERED')
 }else{
  if(p.tradeId!==input.tradeId||p.runLineageId!==input.runLineageId||p.userId!==input.userId||p.strategyId!==input.strategyId||p.instrumentId!==input.instrumentId)throw new Error('TRADE_MEMORY_IDENTITY_MISMATCH')
  if(index!==p.sequenceIndex+1)throw new Error('TRADE_MEMORY_SEQUENCE_VIOLATION:'+p.currentEvent+'->'+input.type)
  if(Date.parse(input.occurredAt)<Date.parse(p.updatedAt))throw new Error('TRADE_MEMORY_TIME_REGRESSION')
 }
 const references=Object.freeze({...p?.references,[input.type]:input.referenceId})
 const eventIds=Object.freeze([...(p?.eventIds??[]),input.eventId])
 const evidenceIds=unique([...(p?.evidenceIds??[]),...input.evidenceIds])
 return Object.freeze({
  tradeId:input.tradeId,
  runLineageId:input.runLineageId,
  userId:input.userId,
  strategyId:input.strategyId,
  instrumentId:input.instrumentId,
  currentEvent:input.type,
  sequenceIndex:index,
  eventIds,
  references,
  evidenceIds,
  positionOpen:index>=indexOf('FILLED')&&index<indexOf('EXITED'),
  completed:input.type==='TRADE_REVIEWED',
  createdAt:p?.createdAt??input.occurredAt,
  updatedAt:input.occurredAt,
  authority:'TRADE_MEMORY_ONLY' as const,
  canAuthorizeTrade:false as const,
 })
}

function apply(input:TradeLifecycleAppendInput,previous?:TradeRecord):TradeRecord{
 for(const [value,code] of [
  [input.id,'TRADE_MEMORY_EVENT_ID_REQUIRED'],
  [input.tradeId,'TRADE_MEMORY_TRADE_ID_REQUIRED'],
  [input.runLineageId,'TRADE_MEMORY_LINEAGE_REQUIRED'],
  [input.userId,'TRADE_MEMORY_USER_REQUIRED'],
  [input.strategyId,'TRADE_MEMORY_STRATEGY_REQUIRED'],
  [input.instrumentId,'TRADE_MEMORY_INSTRUMENT_REQUIRED'],
  [input.referenceId,'TRADE_MEMORY_REFERENCE_REQUIRED'],
 ] as const)required(value,code)
 iso(input.occurredAt,'TRADE_MEMORY_TIME_INVALID')
 if(!input.evidenceIds.length)throw new Error('TRADE_MEMORY_EVIDENCE_REQUIRED')
 if(input.context.domain!=='trading')throw new Error('TRADE_MEMORY_DOMAIN_REQUIRED')
 const core=coreRecord({...input,previous})
 return Object.freeze({...core,recordHash:hash(core)})
}

export class TradeMemory implements TradeLifecycleRecorder{
 private readonly records=new Map<string,TradeRecord>()
 constructor(private readonly bus:EventBus,initial:readonly TradeRecord[]=[]){
  for(const record of initial){
   if(this.records.has(record.tradeId))throw new Error('TRADE_MEMORY_DUPLICATE_INITIAL_RECORD')
   this.records.set(record.tradeId,record)
  }
 }
 get(tradeId:string):TradeRecord|undefined{return this.records.get(tradeId)}
 async record(input:TradeLifecycleAppendInput):Promise<TradeRecord>{
  const previous=this.records.get(input.tradeId)
  if(previous?.eventIds.at(-1)===input.id&&previous.currentEvent===input.type)return previous
  const next=apply(input,previous)
  const event:DomainEvent<TradeMemoryEventPayload>=Object.freeze({
   id:input.id,
   type:input.type,
   occurredAt:input.occurredAt,
   context:Object.freeze({...input.context}),
   payload:Object.freeze({
    tradeId:input.tradeId,
    runLineageId:input.runLineageId,
    userId:input.userId,
    strategyId:input.strategyId,
    instrumentId:input.instrumentId,
    referenceId:input.referenceId,
    evidenceIds:Object.freeze([...input.evidenceIds]),
    details:Object.freeze({...input.details}),
    record:next,
    authority:'TRADE_MEMORY_EVENT_ONLY' as const,
    canAuthorizeTrade:false as const,
   }),
  })
  await this.bus.publish(event)
  this.records.set(input.tradeId,next)
  return next
 }
}

export function rebuildTradeRecord(events:readonly DomainEvent<unknown>[],tradeId:string):TradeRecord{
 let record:TradeRecord|undefined
 for(const event of events){
  if(!TRADING_EVENT_SEQUENCE.includes(event.type as TradingEventType))continue
  const payload=event.payload as Partial<TradeMemoryEventPayload>
  if(payload.tradeId!==tradeId)continue
  if(!event.context)throw new Error('TRADE_MEMORY_REPLAY_CONTEXT_REQUIRED')
  const candidate=apply({
   id:event.id,
   type:event.type as TradingEventType,
   occurredAt:event.occurredAt,
   context:event.context,
   tradeId:String(payload.tradeId??''),
   runLineageId:String(payload.runLineageId??''),
   userId:String(payload.userId??''),
   strategyId:String(payload.strategyId??''),
   instrumentId:String(payload.instrumentId??''),
   referenceId:String(payload.referenceId??''),
   evidenceIds:Array.isArray(payload.evidenceIds)?payload.evidenceIds:[],
   details:payload.details??{},
  },record)
  if(payload.record?.recordHash&&payload.record.recordHash!==candidate.recordHash)throw new Error('TRADE_MEMORY_REPLAY_HASH_MISMATCH')
  record=candidate
 }
 if(!record)throw new Error('TRADE_MEMORY_RECORD_NOT_FOUND')
 return record
}
