import { describe, expect, it } from 'vitest'
import { createPaperTradeProposal } from './paper-trade-contracts'
import { markPaperPosition, proposePaperExit, simulatePaperEntry, simulatePaperExitFill } from './paper-execution'
import { attributePaperTrade, evaluatePaperTradeOutcome } from './paper-trade-outcome'
import { createPaperTradeLearningRecord, assertPaperLearningMayInfluence } from './paper-trade-learning'
import { calibratePaperStrategy } from './paper-strategy-calibration'

describe('SHARK paper trading regression', () => {
  it('closes a deterministic PAPER_ONLY trade and preserves provenance into learning', () => {
    const proposal = createPaperTradeProposal({ proposalId: 'p1', chainId: 'solana', tokenAddress: 'mint1', quoteAsset: 'USD', proposedAt: '2026-09-18T20:00:00Z', simulatedCapital: 100, entryPrice: 1, assumptions: { feeBps: 10, slippageBps: 20 }, provenance: { assessmentId: 'a1', decisionProposalId: 'd1', evidenceIds: ['e1'] } })
    const entryObs = { observationId: 'm1', observedAt: '2026-09-18T20:00:01Z', chainId: 'solana', tokenAddress: 'mint1', price: 1 }
    const entry = simulatePaperEntry(proposal, entryObs)
    expect(entry.position.simulationAuthority).toBe('PAPER_ONLY')
    const markObs = { observationId: 'm2', observedAt: '2026-09-18T20:01:00Z', chainId: 'solana', tokenAddress: 'mint1', price: 2 }
    const mark = markPaperPosition(entry.position, markObs)
    const exit = proposePaperExit(entry.position, markObs, { peakPrice: 2, liquidityUsd: 100000, momentumScore: 0.2, distributionScore: 0.8, riskScore: 0.8, thesisStrength: 0.2, secondsSinceEntry: 180 })
    expect(exit).toBeDefined()
    const fullExit = { ...exit!, quantity: entry.position.quantity, fractionOfPosition: 1 }
    const closed = simulatePaperExitFill(proposal, entry.position, fullExit, markObs)
    expect(closed.position.status).toBe('CLOSED')
    const outcome = evaluatePaperTradeOutcome({ proposal, position: closed.position, fills: [entry.fill, closed.fill], marks: [mark], evaluatedAt: '2026-09-18T20:01:01Z' })
    expect(outcome.label).toBe('WIN')
    expect(outcome.assessmentId).toBe('a1')
    const attribution = attributePaperTrade({ outcome, proposal, entryFill: entry.fill, exitFills: [closed.fill], exits: [fullExit], attributedAt: '2026-09-18T20:01:02Z' })
    const learning = createPaperTradeLearningRecord({ outcome, attribution, scenarioId: 's1', strategyId: 'NEW_PAIR_POST_BUNDLE_DIP', createdAt: '2026-09-18T20:01:03Z' })
    expect(learning.evidenceClass).toBe('SIMULATED_TRADE_OUTCOME')
    expect(learning.experience.provenanceComplete).toBe(true)
  })

  it('fails closed when simulation learning is promoted to observed market fact', () => {
    expect(() => assertPaperLearningMayInfluence('OBSERVED_MARKET_FACT')).toThrow('paper_learning_cannot_promote_to_observed_fact')
  })

  it('does not support a strategy before minimum simulated evidence exists', () => {
    const calibration = calibratePaperStrategy({ strategyId: 'NEW_PAIR_POST_BUNDLE_DIP', weightedExperiences: [], trainingScenarios: [], candidateScenario: { scenarioId: 's', strategyId: 'NEW_PAIR_POST_BUNDLE_DIP', regime: 'launch', volatility: .8, liquidity: .5, spread: .2, instrument: 'meme', horizon: 'minutes' }, calibratedAt: '2026-09-18T20:02:00Z' })
    expect(calibration.status).toBe('INSUFFICIENT_EVIDENCE')\n    expect(calibration.recommendedConfidence).toBeNull()
    expect(calibration.simulationAuthority).toBe('PAPER_ONLY')
  })
})
