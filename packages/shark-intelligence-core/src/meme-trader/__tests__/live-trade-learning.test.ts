import { describe, expect, it } from 'vitest'
import { createClosedMemeTradeLearningRecord } from '../live-trade-learning'

describe('closed meme trade learning',()=>{
  it('attributes signals, sizing, execution drag and narrative outcome without execution authority',()=>{
    const record=createClosedMemeTradeLearningRecord({
      tradeId:'trade:1',
      runLineageId:'lineage:1',
      sourceAssessmentId:'assessment:1',
      sourceThesisId:'thesis:1',
      strategyId:'shark:meme:v1',
      instrumentId:'solana:TOKEN1',
      openedAt:'2026-09-27T20:00:00Z',
      exitedAt:'2026-09-27T20:20:00Z',
      plannedEntryNotionalMinor:1000n,
      realizedEntryNotionalMinor:1300n,
      realizedExitNotionalMinor:1100n,
      modeledSlippageBps:40,
      realizedEntrySlippageBps:90,
      realizedExitSlippageBps:110,
      grossReturnBps:-900,
      netReturnBps:-1100,
      feesPaidMinor:25n,
      expectedNarrative:'Wallet accumulation would continue after the catalyst.',
      observedNarrative:'Tracked wallets distributed while attention decayed.',
      narrativeHeld:false,
      signalOutcomes:[
        {signalId:'wallet:1',signalName:'wallet-cluster',entryExpectation:'accumulation persists',observedOutcome:'distribution began',confidenceBps:8200,worked:false,evidenceIds:['wallet:e']},
        {signalId:'liquidity:1',signalName:'liquidity-depth',entryExpectation:'exit liquidity remains adequate',observedOutcome:'exit remained executable',confidenceBps:7600,worked:true,evidenceIds:['liq:e']},
      ],
      exitReasonCodes:['THESIS_EXPLICITLY_INVALIDATED'],
      originalEvidenceIds:['assessment:e','thesis:e'],
      outcomeEvidenceIds:['fill:e','exit:e'],
    })
    expect(record.sizing.diagnosis).toBe('OVER_SIZED')
    expect(record.execution.diagnosis).toBe('WORSE_THAN_MODELED')
    expect(record.narrative.diagnosis).toBe('DEGRADED_OR_FAILED')
    expect(record.signalsWorked).toEqual(['liquidity-depth'])
    expect(record.signalsFailed).toEqual(['wallet-cluster'])
    expect(record.lessonTags).toEqual(expect.arrayContaining(['SIZING_MISALIGNED','EXECUTION_COST_UNDERESTIMATED','NARRATIVE_FAILED_OR_DEGRADED','SIGNAL_FAILURE_PRESENT','NET_LOSS']))
    expect(record.authority).toBe('LEARNING_ONLY')
    expect(record.financialAuthority).toBe('NONE')
    expect(record.canExecute).toBe(false)
  })
})
