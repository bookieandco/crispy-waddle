import test from 'node:test'
import assert from 'node:assert/strict'
import { createApprovedDexSwapIntent, type DexSwapIntent } from './solana-dex-runtime-contracts.js'
import type { EdgeDecisionBundleReceipt,Edge007IntegrityReceipt } from './dex-four-stage-certification.js'
import { createMoneyPositionManagementConsumer, publishMoneyRiskApproved, publishOrderIntentCreated, publishPositionExited, type MoneyTradeStageEmission, type MoneyTradeStageEventSink } from './trade-runtime-events.js'
import type { PositionExitIntentCandidate } from './position-management.js'

const edgeDecisionBundle:EdgeDecisionBundleReceipt={
  frameworkVersion:'EDGE-001-006-v1',
  receipts:(['EDGE-001','EDGE-002','EDGE-003','EDGE-004','EDGE-005','EDGE-006'] as const).map(gateId=>({
    gateId,version:'EDGE-001-006-v1',disposition:'PASS' as const,reasonCodes:[],evidenceIds:[gateId+':e'],
    evaluatedAt:'2026-09-27T19:59:58Z',authority:'RESEARCH_AND_RISK_GATE_ONLY' as const,canAuthorizeTrade:false as const,
  })),
  disposition:'PASS',reasonCodes:[],evidenceIds:['edge:bundle:e'],authority:'RESEARCH_AND_RISK_GATE_ONLY',canAuthorizeTrade:false,
}
const integrity:Edge007IntegrityReceipt={
  guardVersion:'EDGE-007-v1',guardId:'edge007:1',disposition:'PASS',reasonCodes:[],evidenceIds:['edge007:e'],
  authority:'INTEGRITY_VETO_ONLY',canAuthorizeTrade:false,canAuthorizePromotion:false,
}

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
  governance:{
    sharkAssessmentId:'assessment:1',
    thesisId:'thesis:1',
    edgeDecisionBundle,
    integrityGuard:integrity,
    moneyRisk:{
      riskDecisionId:'risk:'+leg.toLowerCase(),disposition:'APPROVE',reasonCodes:[],evidenceIds:['risk:e'],
      evaluatedAt:'2026-09-27T20:00:00Z',authority:'MONEY_RISK_DECISION',canExecute:false,
    },
    approvedAt:'2026-09-27T20:00:01Z',
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
    domain:'MEME',
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


test('Money consumes POSITION_MONITORED into an independent exit candidate',async()=>{
  let exitId=''
  const consumer=createMoneyPositionManagementConsumer({
    loadPosition:()=>({
      positionId:'position:1',domain:'MEME',instrumentId:'solana:TOKEN1',side:'LONG',quantity:100,
      entryPrice:1,currentExecutableExitPrice:.85,currentExecutableAddPrice:.86,
      costBasisMinor:1000n,currentValueMinor:850n,unrealizedPnlMinor:-150n,peakUnrealizedPnlMinor:200n,
      grossExposureMinor:850n,currency:'USD',openedAt:'2026-09-27T20:00:00Z',observedAt:'2026-09-27T20:11:00Z',
      evidenceIds:['position:e'],authority:'EVIDENCE_ONLY',
    }),
    loadAssessment:()=>({
      edgeAfterCostsBps:-700,thesisStrengthBps:3000,invalidationRiskBps:9300,liquidityQualityBps:5500,liquidityUsd:120000,
      smartWalletExitRiskBps:9400,smartWalletNetFlowUsd:-65000,narrativeDegradationBps:9200,
      whaleDistributionRiskBps:9100,whaleNetFlowUsd:-90000,thesisInvalidated:true,
      thesisInvalidationReasons:['Wallet cohort reversed and whales distributed.'],momentumBps:2500,correlationRiskBps:2000,
      alphaRoutes:[],evidenceIds:['assessment:current'],assessedAt:'2026-09-27T20:11:30Z',
      authority:'INTELLIGENCE_ONLY',canExecute:false,
    }),
    onExitCandidate:candidate=>{exitId=candidate.exitIntentId},
  })
  const result=await consumer.evaluate({
    type:'POSITION_MONITORED',
    occurredAt:'2026-09-27T20:12:00Z',
    payload:{
      tradeId:'trade:1',runLineageId:'lineage:1',strategyId:'shark:meme:v1',instrumentId:'solana:TOKEN1',
      tokenAddress:'TOKEN1',evidenceIds:['position-monitor:e'],details:{action:'EXIT'},
    },
  })
  assert.equal(result?.decision.action,'EXIT')
  assert.equal(result?.exitCandidate?.origin,'INDEPENDENT_POSITION_REUNDERWRITE')
  assert.equal(result?.exitCandidate?.canExecute,false)
  assert.equal(exitId,result?.exitCandidate?.exitIntentId)
})
