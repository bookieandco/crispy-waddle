import test from 'node:test'
import assert from 'node:assert/strict'
import { DurableEventBus, InMemoryEventJournal } from './index'
import { createTradeStreamEvent, wireTradeEventConsumers, type TradeEventType, type TradeLeg } from './trade-events'
import { InMemoryTradeMemoryStore, TradeMemoryProjector } from './trade-memory'

const context=(id:string)=>({
  workSessionId:'ws:trade:1',
  correlationId:'corr:trade:1',
  domain:'JHADINA',
  capability:'money.trade',
  authorityRef:'trace-only',
  idempotencyKey:id,
})

const evt=(id:string,type:TradeEventType,leg:TradeLeg,details:Record<string,unknown>={})=>createTradeStreamEvent({
  id,
  type,
  occurredAt:'2026-09-28T02:30:'+String(Number(id.split(':')[1]??0)).padStart(2,'0')+'.000Z',
  payload:{
    tradeId:'trade:1',
    runLineageId:'lineage:1',
    strategyId:'shark:meme:v1',
    instrumentId:'solana:TOKEN1',
    tokenAddress:'TOKEN1',
    leg,
    evidenceIds:['evidence:'+id],
    details,
  },
  context:context(id),
})

test('trade stream routes every event to Jhadina and memory while SHARK/Money receive scoped events',async()=>{
  const journal=new InMemoryEventJournal()
  const bus=new DurableEventBus(journal)
  const memory=new InMemoryTradeMemoryStore()
  const projector=new TradeMemoryProjector(memory)
  const seen={jhadina:[] as string[],shark:[] as string[],money:[] as string[],memory:[] as string[]}
  wireTradeEventConsumers({
    bus,
    jhadina:event=>{seen.jhadina.push(event.type)},
    shark:event=>{seen.shark.push(event.type)},
    money:event=>{seen.money.push(event.type)},
    sharedMemory:async event=>{seen.memory.push(event.type);await projector.handle(event)},
  })

  const sequence:[string,TradeEventType,TradeLeg,Record<string,unknown>][]=[
    ['evt:01','TOKEN_DISCOVERED','NONE',{source:'dexscreener'}],
    ['evt:02','SHARK_ANALYZED','NONE',{assessmentId:'assessment:1'}],
    ['evt:03','THESIS_CREATED','NONE',{thesisId:'thesis:1'}],
    ['evt:04','RISK_APPROVED','ENTRY',{riskDecisionId:'risk:entry'}],
    ['evt:05','ORDER_INTENT_CREATED','ENTRY',{intentId:'intent:entry'}],
    ['evt:06','TX_SIMULATED','ENTRY',{simulationId:'sim:entry'}],
    ['evt:07','TX_SIGNED','ENTRY',{signature:'sig:entry'}],
    ['evt:08','TX_SENT','ENTRY',{providerReceiptId:'receipt:entry'}],
    ['evt:09','FILLED','ENTRY',{price:1,quantity:100}],
    ['evt:10','POSITION_MONITORED','NONE',{costBasisMinor:'1000',currentValueMinor:'1300'}],
    ['evt:11','RISK_APPROVED','EXIT',{riskDecisionId:'risk:exit'}],
    ['evt:12','ORDER_INTENT_CREATED','EXIT',{intentId:'intent:exit'}],
    ['evt:13','TX_SIMULATED','EXIT',{simulationId:'sim:exit'}],
    ['evt:14','TX_SIGNED','EXIT',{signature:'sig:exit'}],
    ['evt:15','TX_SENT','EXIT',{providerReceiptId:'receipt:exit'}],
    ['evt:16','FILLED','EXIT',{price:1.3,quantity:100}],
    ['evt:17','EXITED','EXIT',{realizedPnlMinor:'300'}],
    ['evt:18','TRADE_REVIEWED','NONE',{reviewId:'review:1',signalsWorked:['wallet-cluster'],signalsFailed:['narrative']}],
  ]
  for(const [id,type,leg,details] of sequence)await bus.publish(evt(id,type,leg,details))

  assert.equal(seen.jhadina.length,18)
  assert.equal(seen.memory.length,18)
  assert.ok(seen.shark.includes('TOKEN_DISCOVERED'))
  assert.ok(seen.shark.includes('TRADE_REVIEWED'))
  assert.ok(!seen.shark.includes('TX_SIGNED'))
  assert.ok(seen.money.includes('RISK_APPROVED'))
  assert.ok(seen.money.includes('FILLED'))

  const record=memory.get('trade:1')
  assert.equal(record?.events.length,18)
  assert.equal(record?.sharkAnalysis?.details.assessmentId,'assessment:1')
  assert.equal(record?.entryOrderIntent?.details.intentId,'intent:entry')
  assert.equal(record?.latestPositionState?.details.currentValueMinor,'1300')
  assert.equal(record?.exitOrderIntent?.details.intentId,'intent:exit')
  assert.equal(record?.review?.details.reviewId,'review:1')
  assert.equal((await journal.listByWorkSession('ws:trade:1')).length,18)
})

test('trade memory rejects illegal execution ordering',async()=>{
  const store=new InMemoryTradeMemoryStore()
  const projector=new TradeMemoryProjector(store)
  await projector.handle(evt('evt:01','TOKEN_DISCOVERED','NONE'))
  await assert.rejects(
    ()=>projector.handle(evt('evt:02','ORDER_INTENT_CREATED','ENTRY')),
    /TRADE_EVENT_ENTRY_EXECUTION_BEFORE_RISK/,
  )
})
