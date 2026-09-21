import { describe,expect,it } from 'vitest'
import { createCanonicalMoneySimulationLearningRecord,weightCanonicalMoneySimulationLearningRecord,type CanonicalMoneySimulationLearningEnvelope } from '../money-simulation-learning'

const envelope:CanonicalMoneySimulationLearningEnvelope={
 schemaVersion:'SHARK-SIM-LEARNING-01',sourceAssessmentId:'a1',sourceProposalId:'p1',strategyId:'NEW_PAIR_POST_BUNDLE_DIP',scenarioId:'launch-1',
 opportunityId:'opp1',paperRunId:'run1',strategyResultId:'result1',terminalState:'CLOSED',returnBps:1200,aggregateFillRateBps:9500,weightedSlippageBps:50,
 feesPaidMinor:'200',currency:'USD',evaluatedAt:'2026-09-21T20:10:00Z',evidenceIds:['money:fill','shark:assessment'],simulationAuthority:'LEARNING_ONLY',financialAuthority:'NONE'
}

describe('canonical Money simulation learning',()=>{
 it('converts governed Money simulation truth into SHARK strategy experience only',()=>{
  const r=createCanonicalMoneySimulationLearningRecord(envelope)
  expect(r.source).toBe('MONEY_CANONICAL_SIMULATION')
  expect(r.evidenceClass).toBe('SIMULATED_TRADE_OUTCOME')
  expect(r.experience.outcomeScore).toBeCloseTo(.12)
  expect(r.experience.confidence).toBeCloseTo(.94525)
  expect(r.experience.provenanceComplete).toBe(true)
  const w=weightCanonicalMoneySimulationLearningRecord(r,new Date('2026-09-21T20:11:00Z'),1)
  expect(w.strategyId).toBe(envelope.strategyId)
 })
 it('refuses open runs because unrealized performance is not closed strategy evidence',()=>{
  expect(()=>createCanonicalMoneySimulationLearningRecord({...envelope,terminalState:'OPEN'})).toThrow('shark_money_simulation_learning_requires_closed_result')
 })
 it('refuses financial authority smuggling',()=>{
  expect(()=>createCanonicalMoneySimulationLearningRecord({...envelope,financialAuthority:'GRANTED' as any})).toThrow('shark_money_simulation_authority_invalid')
 })
})
