import test from 'node:test'
import assert from 'node:assert/strict'
import { createApprovedDexSwapIntent, type DexSwapIntent } from './solana-dex-runtime-contracts.js'
import { publishMoneyRiskApproved, publishOrderIntentCreated, publishPositionExited, type MoneyTradeStageEmission, type MoneyTradeStageEventSink } from './trade-runtime-events.js'
import type { PositionExitIntentCandidate } from './position-management.js'

class Sink implements MoneyTradeStageEventSink{
  readonly rows:MoneyTradeStageEmission[]=[]
  publish(event:MoneyTradeStageEmission){this.rows.push(event)}
}

const intent=(leg:'ENTRY'|'EXIT'):DexSwapIntent=>createApprovedDexSwapIntent({
  draft:{
    executionId:'exec:'+leg.toLowerCase(),
    tradeId:'trade:1',
    requestId:'req:'+leg.toLowerCase(),
    runLineageId:'lineage:1',
    userId:'u1',
    strategyId:'shark:meme:v1',
    instrumentId:'solana:TOKEN1',
    leg,
    provider:'jupiter-ultra',
    walletConnectionId:'wallet:1',
    signerLeaseId:'lease:1',
    inputMint:leg==='ENTRY'?'USDC':'TOKEN1',
    outputMint:leg==='ENTRY'?'TOKEN1':'USDC',
    inputAmountAtomic:1000n,
    minimumOutputAtomic:900n,
    notionalMinor:1000n,
    currency:'USD',
    idempotencyKey:'idem:'+leg.toLowerCase(),
    informationCutoff:'2026-09-27T20:00:00Z',
    evidenceIds:['shark:e'],
  },
  approval:{
    sharkAssessmentId:'assessment:1',
    thesisId:'thesis:1',
    edgeDecisionBundleHash:'edge:hash',
    integrityGuardHash:'integrity:hash',
    moneyRiskDecisionId:'risk:'+leg.toLowerCase(),
    approvedAt:'2026-09-27T20:00:01Z',
    authority:'MONEY_RISK_APPROVAL_BINDING',
  },
})

test('Money publishes governed risk, immutable order intent, and completed exit stages',async()=>{
  const sink=new Sink()
  const entry=intent('ENTRY')
  await publishMoneyRiskApproved({sink,intent:entry,evidenceIds:['risk:e']})
  await publishOrderIntentCreated({sink,intent:entry,createdAt:'2026-09-27T20:00:02Z'})

  const exitIntent:PositionExitIntentCandidate=Object.freeze({
    exitIntentId:'position-exit:1',
    sourceDecisionId:'position-decision:1',
    positionId:'position:1',
    domain:'SHARK_MEME',
    instrumentId:'solana:TOKEN1',
    side:'SELL',
    action:'EXIT',
    quantity:100,
    quantityFractionBps:10000,
    reasonCodes:['THESIS_EXPLICITLY_INVALIDATED'],
    evidenceIds:['position:e'],
    createdAt:'2026-09-27T20:10:00Z',
    origin:'INDEPENDENT_POSITION_REUNDERWRITE',
    authority:'POSITION_EXIT_INTENT_CANDIDATE',
    requiresDownstreamRiskAndAuthority:true,
    canExecute:false,
  })
  await publishPositionExited({
    sink,
    tradeId:'trade:1',
    runLineageId:'lineage:1',
    strategyId:'shark:meme:v1',
    instrumentId:'solana:TOKEN1',
    tokenAddress:'TOKEN1',
    exitIntent,
    occurredAt:'2026-09-27T20:12:00Z',
    realizedPnlMinor:250n,
    exitExecutionId:'exec:exit',
    exitSignature:'sig:exit',
    evidenceIds:['fill:exit'],
  })

  assert.deepEqual(sink.rows.map(row=>row.type),['RISK_APPROVED','ORDER_INTENT_CREATED','EXITED'])
  assert.equal(sink.rows[0]?.details.sharkAssessmentId,'assessment:1')
  assert.equal(sink.rows[1]?.details.authority,'MONEY_EXECUTION_INTENT')
  assert.equal(sink.rows[2]?.details.exitIntentId,'position-exit:1')
  assert.ok(entry.evidenceIds.some(id=>id.startsWith('dex-approval:')))
})
