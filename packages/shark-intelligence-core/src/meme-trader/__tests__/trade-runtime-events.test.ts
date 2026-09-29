import { describe, expect, it } from 'vitest'
import { createClosedMemeTradeLearningRecord } from '../live-trade-learning'
import { reviewMemePosition } from '../position-review'
import {
  createPostExitLearningConsumer,
  publishPositionMonitored,
  publishSharkAnalyzed,
  publishThesisCreated,
  publishTokenDiscovered,
  publishTradeReviewed,
  type SharkTradeStageEmission,
  type SharkTradeStageEventSink,
} from '../trade-runtime-events'

class Sink implements SharkTradeStageEventSink{
  readonly rows:SharkTradeStageEmission[]=[]
  publish(event:SharkTradeStageEmission){this.rows.push(event)}
}

describe('SHARK trade runtime events',()=>{
  it('publishes discovery, analysis, thesis, position and review stages without financial authority',async()=>{
    const sink=new Sink()
    const assessment:any={
      assessmentId:'assessment:1',
      assessedAt:'2026-09-27T20:00:01Z',
      token:{chainId:'solana',tokenAddress:'TOKEN1'},
      assessmentVersion:'v1',
      confidence:.8,
      riskAssessment:{band:'candidate',overallRisk:.2},
      holderCohort:{score:.75},
      attention:{score:.8},
      marketActivityQuality:{liquidityScore:.7},
      thesis:'Tracked wallets and liquidity support the setup.',
      invalidation:{conditions:['wallet distribution','liquidity collapse'],severity:'high'},
      evidenceIds:['assessment:e'],
    }
    await publishTokenDiscovered({sink,tradeId:'trade:1',runLineageId:'lineage:1',strategyId:'shark:meme:v1',instrumentId:'solana:TOKEN1',tokenAddress:'TOKEN1',discoveredAt:'2026-09-27T20:00:00Z',source:'dexscreener',evidenceIds:['discover:e']})
    await publishSharkAnalyzed({sink,tradeId:'trade:1',runLineageId:'lineage:1',strategyId:'shark:meme:v1',assessment})
    await publishThesisCreated({sink,tradeId:'trade:1',runLineageId:'lineage:1',strategyId:'shark:meme:v1',thesisId:'thesis:1',assessment,createdAt:'2026-09-27T20:00:02Z'})

    const state:any={
      entryPrice:1,currentPrice:1.2,peakPrice:1.3,liquidityUsd:200000,liquidityChangePct:-5,momentumScore:.6,distributionScore:.3,riskScore:.4,thesisStrength:.7,secondsSinceEntry:120,
      incrementalEdgeBps:150,correlationRiskBps:2000,costBasisUsd:1000,currentValueUsd:1200,smartWalletExitScore:.2,narrativeDegradationScore:.15,whaleDistributionScore:.25,thesisInvalidated:false,
    }
    const review=reviewMemePosition(state)
    await publishPositionMonitored({sink,tradeId:'trade:1',runLineageId:'lineage:1',strategyId:'shark:meme:v1',instrumentId:'solana:TOKEN1',tokenAddress:'TOKEN1',reviewId:'position-review:1',review,state,observedAt:'2026-09-27T20:05:00Z',evidenceIds:['position:e']})

    const learning=createClosedMemeTradeLearningRecord({
      tradeId:'trade:1',runLineageId:'lineage:1',sourceAssessmentId:'assessment:1',sourceThesisId:'thesis:1',strategyId:'shark:meme:v1',instrumentId:'solana:TOKEN1',
      openedAt:'2026-09-27T20:00:03Z',exitedAt:'2026-09-27T20:10:00Z',plannedEntryNotionalMinor:1000n,realizedEntryNotionalMinor:1000n,realizedExitNotionalMinor:1200n,
      modeledSlippageBps:30,realizedEntrySlippageBps:35,realizedExitSlippageBps:40,grossReturnBps:2000,netReturnBps:1800,feesPaidMinor:20n,
      expectedNarrative:'Wallet accumulation persists.',observedNarrative:'Wallet accumulation persisted through exit.',narrativeHeld:true,
      signalOutcomes:[{signalId:'wallet:1',signalName:'wallet-cluster',entryExpectation:'accumulation',observedOutcome:'accumulation persisted',confidenceBps:8000,worked:true,evidenceIds:['wallet:e']}],
      exitReasonCodes:['PROFIT_TARGET'],originalEvidenceIds:['assessment:e'],outcomeEvidenceIds:['exit:e'],
    })
    await publishTradeReviewed({sink,learning,tokenAddress:'TOKEN1'})

    expect(sink.rows.map(row=>row.type)).toEqual(['TOKEN_DISCOVERED','SHARK_ANALYZED','THESIS_CREATED','POSITION_MONITORED','TRADE_REVIEWED'])
    expect(sink.rows.every(row=>row.domain==='SHARK'&&row.authority==='TRADE_STAGE_EVENT_ONLY')).toBe(true)
    expect(sink.rows[3]?.details.currentValueUsd).toBe(1200)
    expect(sink.rows[4]?.details.signalsWorked).toEqual(['wallet-cluster'])
  })
})


it('automatically closes the SHARK learning loop when EXITED arrives',async()=>{
  const sink=new Sink()
  const consumer=createPostExitLearningConsumer({
    sink,
    loadLearningInput:event=>({
      tradeId:event.payload.tradeId,
      runLineageId:event.payload.runLineageId,
      sourceAssessmentId:'assessment:1',
      sourceThesisId:'thesis:1',
      strategyId:event.payload.strategyId,
      instrumentId:event.payload.instrumentId,
      openedAt:'2026-09-27T20:00:00Z',
      exitedAt:event.occurredAt,
      plannedEntryNotionalMinor:1000n,
      realizedEntryNotionalMinor:1000n,
      realizedExitNotionalMinor:1150n,
      modeledSlippageBps:30,
      realizedEntrySlippageBps:35,
      realizedExitSlippageBps:45,
      grossReturnBps:1500,
      netReturnBps:1300,
      feesPaidMinor:20n,
      expectedNarrative:'Tracked wallets would keep accumulating.',
      observedNarrative:'Accumulation persisted until exit.',
      narrativeHeld:true,
      signalOutcomes:[{
        signalId:'wallet:1',signalName:'wallet-cluster',entryExpectation:'accumulation persists',
        observedOutcome:'accumulation persisted',confidenceBps:8000,worked:true,evidenceIds:['wallet:e'],
      }],
      exitReasonCodes:['PROFIT_TARGET'],
      originalEvidenceIds:['assessment:e','thesis:e'],
      outcomeEvidenceIds:event.payload.evidenceIds,
    }),
  })
  const learning=await consumer.learn({
    type:'EXITED',
    occurredAt:'2026-09-27T20:10:00Z',
    payload:{
      tradeId:'trade:2',runLineageId:'lineage:2',strategyId:'shark:meme:v1',
      instrumentId:'solana:TOKEN2',tokenAddress:'TOKEN2',evidenceIds:['exit:e'],details:{exitExecutionId:'exec:exit'},
    },
  })
  expect(learning?.tradeId).toBe('trade:2')
  expect(sink.rows.map(row=>row.type)).toEqual(['TRADE_REVIEWED'])
  expect(sink.rows[0]?.details.signalsWorked).toEqual(['wallet-cluster'])
})
