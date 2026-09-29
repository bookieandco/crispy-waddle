import {
  DurableEventBus,
  SupabaseEventJournal,
  type EventBus,
  type RuntimeEventDatabaseClient,
} from './index'
import {
  createDomainTradeStageEventSink,
  createMechanicalDexExecutionEventSink,
  wireTradeEventConsumers,
  type TradeEventConsumer,
} from './trade-events'
import {
  SupabaseTradeMemoryStore,
  TradeMemoryProjector,
  type TradeMemoryDatabaseClient,
  type TradeMemoryStore,
} from './trade-memory'

export type DurableTradeRuntimeDatabaseClient=RuntimeEventDatabaseClient&TradeMemoryDatabaseClient

export type DurableTradeRuntimeHandlers=Readonly<{
  jhadina:TradeEventConsumer
  shark:TradeEventConsumer
  money:TradeEventConsumer
}>

export type DurableTradeRuntime=Readonly<{
  bus:EventBus
  memory:TradeMemoryStore
  stageSink:ReturnType<typeof createDomainTradeStageEventSink>
  executionSink:ReturnType<typeof createMechanicalDexExecutionEventSink>
  close:()=>void
  authority:'COORDINATION_ONLY'
  canAuthorizeTrade:false
}>

export function createDurableTradeRuntime(input:{
  db:DurableTradeRuntimeDatabaseClient
  workSessionId:string
  correlationId:string
  actorId?:string
  authorityRef?:string
  tokenAddress?:string
  handlers:DurableTradeRuntimeHandlers
}):DurableTradeRuntime{
  if(!input.workSessionId.trim()||!input.correlationId.trim())throw new Error('TRADE_RUNTIME_CONTEXT_REQUIRED')
  if(!input.handlers.jhadina||!input.handlers.shark||!input.handlers.money)throw new Error('TRADE_RUNTIME_HANDLERS_REQUIRED')

  const journal=new SupabaseEventJournal(input.db)
  const bus=new DurableEventBus(journal)
  const memory=new SupabaseTradeMemoryStore(input.db)
  const projector=new TradeMemoryProjector(memory)

  const close=wireTradeEventConsumers({
    bus,
    jhadina:input.handlers.jhadina,
    shark:input.handlers.shark,
    money:input.handlers.money,
    sharedMemory:event=>projector.handle(event).then(()=>undefined),
  })

  return Object.freeze({
    bus,
    memory,
    stageSink:createDomainTradeStageEventSink({
      bus,
      workSessionId:input.workSessionId,
      correlationId:input.correlationId,
      actorId:input.actorId,
      authorityRef:input.authorityRef,
    }),
    executionSink:createMechanicalDexExecutionEventSink({
      bus,
      workSessionId:input.workSessionId,
      correlationId:input.correlationId,
      actorId:input.actorId,
      authorityRef:input.authorityRef,
      tokenAddress:input.tokenAddress,
    }),
    close,
    authority:'COORDINATION_ONLY',
    canAuthorizeTrade:false,
  })
}
