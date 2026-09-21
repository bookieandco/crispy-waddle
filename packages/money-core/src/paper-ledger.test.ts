import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createPaperLedgerEvent,
  decodePaperLedgerPayload,
  encodePaperLedgerPayload,
  InMemoryPaperLedgerStore,
} from './paper-ledger.js'
import type { PaperFill, PaperOrder, PaperPortfolio } from './paper-execution-contracts.js'

const order:PaperOrder={
  paperOrderId:'paper-order-1',paperRunId:'run-1',executionPlanId:'plan-1',sliceId:'slice-1',instrumentId:'meme:solana:TOKEN',
  side:'BUY',requestedNotional:{minor:100000n,currency:'USD'},instruction:'MARKETABLE_LIMIT',limitPriceMinor:10000n,
  submittedAt:'2026-09-21T20:00:00Z',expiresAt:'2026-09-21T20:05:00Z',marketSnapshotId:'market-1',state:'OPEN',authority:'SIMULATION_ONLY'
}
const fill:PaperFill={
  paperFillId:'paper-fill-1',paperOrderId:order.paperOrderId,instrumentId:order.instrumentId,side:'BUY',
  notional:{minor:100000n,currency:'USD'},quantityMicros:10000000n,referencePriceMinor:10000n,fillPriceMinor:10010n,
  fee:{minor:50n,currency:'USD'},slippageBps:10,filledAt:'2026-09-21T20:00:01Z',marketSnapshotId:'market-1',
  evidenceIds:['market:1','assumption:fee'],authority:'SIMULATION_ONLY'
}
const portfolio:PaperPortfolio={
  paperPortfolioId:'portfolio-1',paperRunId:'run-1',currency:'USD',cash:{minor:99950n,currency:'USD'},positions:[],
  realizedPnl:{minor:0n,currency:'USD'},feesPaid:{minor:50n,currency:'USD'},asOf:'2026-09-21T20:00:02Z',stateHash:'state-1',authority:'SIMULATION_ONLY'
}

test('043-ledger.1 bigint payload encoding round-trips exactly',()=>{
  const encoded=encodePaperLedgerPayload(fill)
  const decoded=decodePaperLedgerPayload(JSON.parse(encoded)) as PaperFill
  assert.equal(decoded.notional.minor,100000n)
  assert.equal(decoded.quantityMicros,10000000n)
  assert.equal(decoded.fee.minor,50n)
})

test('043-ledger.2 append is deterministic and replay-idempotent',()=>{
  const store=new InMemoryPaperLedgerStore(),event=createPaperLedgerEvent({paperRunId:'run-1',kind:'ORDER',payload:order})
  assert.equal(store.append(event).disposition,'INSERTED')
  assert.equal(store.append(event).disposition,'REPLAY')
  assert.equal(store.list('run-1').length,1)
})

test('043-ledger.3 run history is time ordered and preserves simulation authority',()=>{
  const store=new InMemoryPaperLedgerStore()
  const fillEvent=createPaperLedgerEvent({paperRunId:'run-1',kind:'FILL',payload:fill})
  const orderEvent=createPaperLedgerEvent({paperRunId:'run-1',kind:'ORDER',payload:order})
  const portfolioEvent=createPaperLedgerEvent({paperRunId:'run-1',kind:'PORTFOLIO_SNAPSHOT',payload:portfolio,evidenceIds:['paper-fill-1']})
  store.append(portfolioEvent);store.append(fillEvent);store.append(orderEvent)
  const events=store.list('run-1')
  assert.deepEqual(events.map(x=>x.kind),['ORDER','FILL','PORTFOLIO_SNAPSHOT'])
  assert.ok(events.every(x=>x.authority==='SIMULATION_RECORD_ONLY'))
})

test('043-ledger.4 event construction rejects run mismatch and live authority material',()=>{
  assert.throws(()=>createPaperLedgerEvent({paperRunId:'other-run',kind:'ORDER',payload:order}),/RUN_BINDING_MISMATCH/)
  assert.throws(()=>createPaperLedgerEvent({paperRunId:'run-1',kind:'ORDER',payload:{...order,authority:'LIVE' as any}}),/SIMULATION_AUTHORITY_INVALID/)
})
