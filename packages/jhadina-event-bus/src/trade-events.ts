import type { DomainEvent, EventBus, RuntimeEventContext } from './index'

export const TRADE_EVENT_TYPES = Object.freeze([
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

export type TradeEventType = typeof TRADE_EVENT_TYPES[number]
export type TradeLeg = 'NONE' | 'ENTRY' | 'EXIT'

export type TradeStreamPayload = Readonly<{
  tradeId:string
  runLineageId:string
  strategyId:string
  instrumentId:string
  tokenAddress?:string
  leg:TradeLeg
  evidenceIds:readonly string[]
  details:Readonly<Record<string,unknown>>
}>

export type TradeStreamEvent = DomainEvent<TradeStreamPayload> & Readonly<{type:TradeEventType}>

export type TradeEventConsumer = (event:TradeStreamEvent)=>Promise<void>|void

const SHARK_EVENTS:ReadonlySet<TradeEventType>=new Set([
  'TOKEN_DISCOVERED',
  'SHARK_ANALYZED',
  'THESIS_CREATED',
  'POSITION_MONITORED',
  'EXITED',
  'TRADE_REVIEWED',
])

const MONEY_EVENTS:ReadonlySet<TradeEventType>=new Set([
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
])

function nonEmpty(value:string,code:string):void{
  if(!value.trim())throw new Error(code)
}

function validIso(value:string):boolean{
  return Boolean(value.trim())&&!Number.isNaN(Date.parse(value))
}

export function assertTradeStreamPayload(payload:TradeStreamPayload):void{
  nonEmpty(payload.tradeId,'TRADE_EVENT_TRADE_ID_REQUIRED')
  nonEmpty(payload.runLineageId,'TRADE_EVENT_LINEAGE_REQUIRED')
  nonEmpty(payload.strategyId,'TRADE_EVENT_STRATEGY_REQUIRED')
  nonEmpty(payload.instrumentId,'TRADE_EVENT_INSTRUMENT_REQUIRED')
  if(!payload.evidenceIds.length)throw new Error('TRADE_EVENT_EVIDENCE_REQUIRED')
  if(payload.leg==='NONE'&&['RISK_APPROVED','ORDER_INTENT_CREATED','TX_SIMULATED','TX_SIGNED','TX_SENT','FILLED','EXITED'].includes(String((payload.details as Record<string,unknown>).eventType??''))){
    throw new Error('TRADE_EVENT_EXECUTION_LEG_REQUIRED')
  }
}

export function createTradeStreamEvent(input:{
  id:string
  type:TradeEventType
  occurredAt:string
  payload:TradeStreamPayload
  context:RuntimeEventContext
}):TradeStreamEvent{
  nonEmpty(input.id,'TRADE_EVENT_ID_REQUIRED')
  if(!TRADE_EVENT_TYPES.includes(input.type))throw new Error('TRADE_EVENT_TYPE_INVALID')
  if(!validIso(input.occurredAt))throw new Error('TRADE_EVENT_TIME_INVALID')
  assertTradeStreamPayload(input.payload)
  const executionType=['RISK_APPROVED','ORDER_INTENT_CREATED','TX_SIMULATED','TX_SIGNED','TX_SENT','FILLED','EXITED'].includes(input.type)
  if(executionType&&input.payload.leg==='NONE')throw new Error('TRADE_EVENT_EXECUTION_LEG_REQUIRED')
  if(input.context.domain!=='MONEY'&&input.context.domain!=='SHARK'&&input.context.domain!=='JHADINA'){
    throw new Error('TRADE_EVENT_DOMAIN_INVALID')
  }
  return Object.freeze({
    id:input.id,
    type:input.type,
    occurredAt:input.occurredAt,
    payload:Object.freeze({
      ...input.payload,
      evidenceIds:Object.freeze([...new Set(input.payload.evidenceIds)]),
      details:Object.freeze({...input.payload.details}),
    }),
    context:Object.freeze({...input.context}),
  })
}

export function subscribeTradeStream(bus:EventBus,consumer:TradeEventConsumer):()=>void{
  const unsubscribers=TRADE_EVENT_TYPES.map(type=>bus.subscribe<TradeStreamPayload>(type,event=>consumer(event as TradeStreamEvent)))
  return ()=>{for(const unsubscribe of unsubscribers)unsubscribe()}
}

export function wireTradeEventConsumers(input:{
  bus:EventBus
  jhadina:TradeEventConsumer
  shark:TradeEventConsumer
  money:TradeEventConsumer
  sharedMemory:TradeEventConsumer
}):()=>void{
  const unsubscribers:(()=>void)[]=[]
  for(const type of TRADE_EVENT_TYPES){
    unsubscribers.push(input.bus.subscribe<TradeStreamPayload>(type,async event=>{
      const tradeEvent=event as TradeStreamEvent
      await input.jhadina(tradeEvent)
      await input.sharedMemory(tradeEvent)
      if(SHARK_EVENTS.has(type))await input.shark(tradeEvent)
      if(MONEY_EVENTS.has(type))await input.money(tradeEvent)
    }))
  }
  return ()=>{for(const unsubscribe of unsubscribers)unsubscribe()}
}

type ExecutionProgress = -1|0|1|2|3|4|5
type TradeProgress=Readonly<{
  discovered:boolean
  analyzed:boolean
  thesis:boolean
  entryRisk:boolean
  entryExecution:ExecutionProgress
  monitored:boolean
  exitRisk:boolean
  exitExecution:ExecutionProgress
  exited:boolean
  reviewed:boolean
}>

const initialProgress=():TradeProgress=>Object.freeze({
  discovered:false,
  analyzed:false,
  thesis:false,
  entryRisk:false,
  entryExecution:-1,
  monitored:false,
  exitRisk:false,
  exitExecution:-1,
  exited:false,
  reviewed:false,
})

const EXECUTION_STEP:Readonly<Partial<Record<TradeEventType,ExecutionProgress>>>=Object.freeze({
  ORDER_INTENT_CREATED:0,
  TX_SIMULATED:1,
  TX_SIGNED:2,
  TX_SENT:3,
  FILLED:4,
})

export class TradeEventSequenceGuard{
  private readonly state=new Map<string,TradeProgress>()

  accept(event:TradeStreamEvent):TradeProgress{
    const current=this.state.get(event.payload.tradeId)??initialProgress()
    const next={...current}
    const fail=(code:string):never=>{throw new Error(code)}

    switch(event.type){
      case 'TOKEN_DISCOVERED':
        if(current.discovered)fail('TRADE_EVENT_DUPLICATE_DISCOVERY')
        next.discovered=true
        break
      case 'SHARK_ANALYZED':
        if(!current.discovered)fail('TRADE_EVENT_ANALYSIS_BEFORE_DISCOVERY')
        next.analyzed=true
        break
      case 'THESIS_CREATED':
        if(!current.analyzed)fail('TRADE_EVENT_THESIS_BEFORE_ANALYSIS')
        next.thesis=true
        break
      case 'RISK_APPROVED':
        if(!current.thesis)fail('TRADE_EVENT_RISK_BEFORE_THESIS')
        if(event.payload.leg==='ENTRY')next.entryRisk=true
        else if(event.payload.leg==='EXIT'){
          if(!current.monitored)fail('TRADE_EVENT_EXIT_RISK_BEFORE_MONITORING')
          next.exitRisk=true
        }else fail('TRADE_EVENT_RISK_LEG_REQUIRED')
        break
      case 'ORDER_INTENT_CREATED':
      case 'TX_SIMULATED':
      case 'TX_SIGNED':
      case 'TX_SENT':
      case 'FILLED':{
        const step=EXECUTION_STEP[event.type]
        if(step===undefined)fail('TRADE_EVENT_EXECUTION_STEP_INVALID')
        const entry=event.payload.leg==='ENTRY'
        const exit=event.payload.leg==='EXIT'
        if(!entry&&!exit)fail('TRADE_EVENT_EXECUTION_LEG_REQUIRED')
        if(entry&&!current.entryRisk)fail('TRADE_EVENT_ENTRY_EXECUTION_BEFORE_RISK')
        if(exit&&!current.exitRisk)fail('TRADE_EVENT_EXIT_EXECUTION_BEFORE_RISK')
        const prior=entry?current.entryExecution:current.exitExecution
        if(step!==prior+1)fail('TRADE_EVENT_EXECUTION_ORDER_INVALID')
        if(entry)next.entryExecution=step
        else next.exitExecution=step
        break
      }
      case 'POSITION_MONITORED':
        if(current.entryExecution<4)fail('TRADE_EVENT_MONITOR_BEFORE_ENTRY_FILL')
        if(current.exited)fail('TRADE_EVENT_MONITOR_AFTER_EXIT')
        next.monitored=true
        break
      case 'EXITED':
        if(event.payload.leg!=='EXIT'||current.exitExecution<4)fail('TRADE_EVENT_EXIT_BEFORE_EXIT_FILL')
        next.exited=true
        break
      case 'TRADE_REVIEWED':
        if(!current.exited)fail('TRADE_EVENT_REVIEW_BEFORE_EXIT')
        next.reviewed=true
        break
    }

    const frozen=Object.freeze(next) as TradeProgress
    this.state.set(event.payload.tradeId,frozen)
    return frozen
  }

  snapshot(tradeId:string):TradeProgress{
    return this.state.get(tradeId)??initialProgress()
  }
}


export async function publishTradeStageEvent(input:{
  bus:EventBus
  id:string
  type:TradeEventType
  occurredAt:string
  payload:TradeStreamPayload
  context:RuntimeEventContext
}):Promise<TradeStreamEvent>{
  const event=createTradeStreamEvent(input)
  await input.bus.publish(event)
  return event
}

export type MechanicalDexExecutionTelemetry=Readonly<{
  type:'TX_SIMULATED'|'TX_SIGNED'|'TX_SENT'|'FILLED'
  tradeId:string
  executionId:string
  runLineageId:string
  strategyId:string
  instrumentId:string
  leg:'ENTRY'|'EXIT'
  occurredAt:string
  evidenceIds:readonly string[]
  details:Readonly<Record<string,unknown>>
  authority:'EXECUTION_TELEMETRY_ONLY'
}>

export function createMechanicalDexExecutionEventSink(input:{
  bus:EventBus
  workSessionId:string
  correlationId:string
  actorId?:string
  authorityRef?:string
  tokenAddress?:string
}):Readonly<{publish(event:MechanicalDexExecutionTelemetry):Promise<void>}>{
  return Object.freeze({
    publish:async(event:MechanicalDexExecutionTelemetry)=>{
      if(event.authority!=='EXECUTION_TELEMETRY_ONLY')throw new Error('TRADE_EVENT_EXECUTOR_AUTHORITY_INVALID')
      const id=`trade:${event.tradeId}:${event.executionId}:${event.type}`
      await publishTradeStageEvent({
        bus:input.bus,
        id,
        type:event.type,
        occurredAt:event.occurredAt,
        payload:{
          tradeId:event.tradeId,
          runLineageId:event.runLineageId,
          strategyId:event.strategyId,
          instrumentId:event.instrumentId,
          tokenAddress:input.tokenAddress,
          leg:event.leg,
          evidenceIds:event.evidenceIds,
          details:{executionId:event.executionId,...event.details},
        },
        context:{
          workSessionId:input.workSessionId,
          correlationId:input.correlationId,
          actorId:input.actorId,
          domain:'MONEY',
          capability:'money.trade.execute',
          authorityRef:input.authorityRef,
          idempotencyKey:id,
        },
      })
    },
  })
}
