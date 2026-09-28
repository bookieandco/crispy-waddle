import { describe,it } from 'node:test'
import assert from 'node:assert/strict'
import { DurableEventBus,InMemoryEventJournal } from './index.js'
import { TradeMemory,TRADING_EVENT_SEQUENCE,rebuildTradeRecord,type TradingEventType } from './trade-memory.js'

const context=(type:TradingEventType,index:number)=>({
 workSessionId:'trade-ws-1',
 taskId:'trade-task-1',
 correlationId:'trade-1',
 causationId:index?('trade-event-'+index):undefined,
 actorId:type.startsWith('SHARK')?'shark':'money',
 domain:'trading',
 capability:'money.trade.lifecycle',
 authorityRef:'trade-policy:1',
 idempotencyKey:'trade-1:'+type,
})

describe('TRADE-MEMORY.FINAL',()=>{
 it('journals the exact canonical trading sequence and rebuilds the same TradeRecord',async()=>{
  const journal=new InMemoryEventJournal()
  const memory=new TradeMemory(new DurableEventBus(journal))
  let last
  for(let i=0;i<TRADING_EVENT_SEQUENCE.length;i++){
   const type=TRADING_EVENT_SEQUENCE[i]!
   last=await memory.record({
    id:'trade-event-'+(i+1),
    type,
    occurredAt:new Date(Date.UTC(2026,8,27,20,0,i)).toISOString(),
    context:context(type,i),
    tradeId:'trade-1',
    runLineageId:'lineage-1',
    userId:'user-1',
    strategyId:'shark:meme:v1',
    instrumentId:'solana:TOKEN',
    referenceId:type.toLowerCase()+':ref',
    evidenceIds:['evidence:'+type],
    details:{ordinal:i+1},
   })
  }
  const events=await journal.listByWorkSession('trade-ws-1')
  assert.deepEqual(events.map(event=>event.type),[...TRADING_EVENT_SEQUENCE])
  assert.equal(last?.currentEvent,'TRADE_REVIEWED')
  assert.equal(last?.completed,true)
  assert.equal(last?.positionOpen,false)
  const rebuilt=rebuildTradeRecord(events,'trade-1')
  assert.equal(rebuilt.recordHash,last?.recordHash)
  assert.deepEqual(rebuilt.eventIds,last?.eventIds)
 })
 it('fails closed when an event skips the canonical sequence',async()=>{
  const journal=new InMemoryEventJournal()
  const memory=new TradeMemory(new DurableEventBus(journal))
  await memory.record({
   id:'trade-event-1',type:'TOKEN_DISCOVERED',occurredAt:'2026-09-27T20:00:00.000Z',context:context('TOKEN_DISCOVERED',0),
   tradeId:'trade-1',runLineageId:'lineage-1',userId:'user-1',strategyId:'s',instrumentId:'i',referenceId:'token',evidenceIds:['e'],
  })
  await assert.rejects(()=>memory.record({
   id:'trade-event-2',type:'RISK_APPROVED',occurredAt:'2026-09-27T20:00:01.000Z',context:context('RISK_APPROVED',1),
   tradeId:'trade-1',runLineageId:'lineage-1',userId:'user-1',strategyId:'s',instrumentId:'i',referenceId:'risk',evidenceIds:['e'],
  }),/TRADE_MEMORY_SEQUENCE_VIOLATION/)
  assert.equal((await journal.listByWorkSession('trade-ws-1')).length,1)
 })
 it('makes exact same-event retries idempotent without duplicating the durable journal',async()=>{
  const journal=new InMemoryEventJournal()
  const memory=new TradeMemory(new DurableEventBus(journal))
  const input={
   id:'trade-event-1',type:'TOKEN_DISCOVERED' as const,occurredAt:'2026-09-27T20:00:00.000Z',context:context('TOKEN_DISCOVERED',0),
   tradeId:'trade-1',runLineageId:'lineage-1',userId:'user-1',strategyId:'s',instrumentId:'i',referenceId:'token',evidenceIds:['e'],
  }
  const first=await memory.record(input)
  const second=await memory.record(input)
  assert.equal(second.recordHash,first.recordHash)
  assert.equal((await journal.listByWorkSession('trade-ws-1')).length,1)
 })
})
