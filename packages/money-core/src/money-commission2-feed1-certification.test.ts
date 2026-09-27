import test from 'node:test'
import assert from 'node:assert/strict'
import { validateMoneyOwnerCommissioning,type MoneyOwnerCommissioning } from './money-commissioning-contracts.js'
import { assertMoneyFeedEvent,moneyFeedHasCommittedCapital,moneyFeedSource,type MoneyFeedEvent } from './money-feed-contracts.js'

const config=(o:Partial<MoneyOwnerCommissioning>={}):MoneyOwnerCommissioning=>({
 currency:'USD',principalCapitalMinor:100000n,hardStopFloorMinor:10000n,survivalFloorMinor:20000n,defensiveFloorMinor:40000n,maxDeployableBps:5000,
 profitSweepThresholdMinor:25000n,profitRetainMinor:10000n,planningReserveBps:2000,profitSweepEnabled:true,
 strategies:[
  {lane:'MEME',allocatedMinor:15000n,hardCapMinor:10000n},
  {lane:'CRYPTO',allocatedMinor:20000n,hardCapMinor:15000n},
  {lane:'SPORTS',allocatedMinor:10000n,hardCapMinor:10000n},
  {lane:'STOCK',allocatedMinor:25000n,hardCapMinor:20000n},
  {lane:'FOREX',allocatedMinor:15000n,hardCapMinor:10000n},
  {lane:'PREDICTION',allocatedMinor:5000n,hardCapMinor:5000n},
  {lane:'METALS',allocatedMinor:5000n,hardCapMinor:5000n},
 ],authority:'OWNER_CONFIGURATION',canFund:false,canTrade:false,...o
})

test('MONEY-COMMISSION.2 validates owner policy without creating funding or trade authority',()=>{
 const r=validateMoneyOwnerCommissioning(config())
 assert.equal(r.totalAllocatedMinor,95000n)
 assert.equal(r.unallocatedMinor,5000n)
})

test('MONEY-COMMISSION.2 rejects invalid survival ordering and over-allocation',()=>{
 assert.throws(()=>validateMoneyOwnerCommissioning(config({hardStopFloorMinor:30000n,survivalFloorMinor:20000n})),/FLOORS_INVALID/)
 assert.throws(()=>validateMoneyOwnerCommissioning(config({strategies:[{lane:'STOCK',allocatedMinor:100001n,hardCapMinor:100000n}]})),/ALLOCATIONS_EXCEED_PRINCIPAL/)
})

test('MONEY-COMMISSION.2 rejects strategy hard caps above their allocations',()=>{
 assert.throws(()=>validateMoneyOwnerCommissioning(config({strategies:[{lane:'DEX' as never,allocatedMinor:100n,hardCapMinor:100n}]})),/STRATEGY_LANE_INVALID/)
 assert.throws(()=>validateMoneyOwnerCommissioning(config({strategies:[{lane:'STOCK',allocatedMinor:100n,hardCapMinor:101n}]})),/CAP_EXCEEDS_ALLOCATION/)
})

const feed=(o:Partial<MoneyFeedEvent>={}):MoneyFeedEvent=>({
 eventId:'e1',userId:'u1',type:'OPPORTUNITY_SUGGESTED',lane:'SPORTS',commitment:'SUGGESTED',title:'Suggested game angle',body:'Model edge surfaced; no money committed.',
 subjectId:'game:1',route:'/worlds/sports',materiality:80,occurredAt:'2026-09-27T23:30:00Z',evidenceIds:['simulation:1'],authority:'FEED_EVIDENCE_ONLY',canExecute:false,...o
})

test('MONEY-FEED.1 suggestions cannot carry committed money',()=>{
 const e=feed()
 assert.doesNotThrow(()=>assertMoneyFeedEvent(e))
 assert.equal(moneyFeedHasCommittedCapital(e),false)
 assert.equal(moneyFeedSource(e),'Sports')
 assert.throws(()=>assertMoneyFeedEvent(feed({fundedAmountMinor:5000n,currency:'USD'})),/UNFUNDED_EVENT_HAS_MONEY/)
})

test('MONEY-FEED.1 funded positions require explicit committed capital evidence',()=>{
 assert.throws(()=>assertMoneyFeedEvent(feed({type:'POSITION_OPENED',lane:'STOCK',commitment:'COMMITTED'})),/FUNDED_EVIDENCE_REQUIRED/)
 const e=feed({eventId:'e2',type:'POSITION_OPENED',lane:'STOCK',commitment:'COMMITTED',fundedAmountMinor:25000n,currency:'USD',route:'/money/live-operations'})
 assert.doesNotThrow(()=>assertMoneyFeedEvent(e))
 assert.equal(moneyFeedHasCommittedCapital(e),true)
 assert.equal(moneyFeedSource(e),'Money')
})

test('MONEY-FEED.1 feed evidence cannot execute',()=>{
 assert.throws(()=>assertMoneyFeedEvent({...feed(),canExecute:true} as unknown as MoneyFeedEvent),/AUTHORITY_INVALID/)
})
