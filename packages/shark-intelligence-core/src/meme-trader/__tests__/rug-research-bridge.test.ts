import { describe, expect, it } from 'vitest'
import {
  historicalRugResearchSignal, PINNED_RUG_RESEARCH_REVISION,
  type HistoricalRugResearchInput,
} from '../rug-research-bridge'
import { evaluateRugSelfProtection } from '../rug-self-protection'
import type { RugProtectionResult } from '../rug-protection'

const input:HistoricalRugResearchInput = {
  modelId: 'historical-evm-hypothesis-001',
  sourceRevision: PINNED_RUG_RESEARCH_REVISION,
  sourceChain: 'ETH',
  hypothesisScore: 0.99,
  observedAt: '2026-10-15T17:00:00Z',
  availableAt: '2026-10-15T17:01:00Z',
  informationCutoff: '2026-10-15T17:02:00Z',
  evidenceIds: ['research:source-pin', 'research:source-pin'],
}

const safeCandidate:RugProtectionResult = {
  disposition: 'ALLOW_CANDIDATE',
  score: 0,
  hardBlockers: [],
  warnings: [],
  evidenceIds: ['deterministic:baseline'],
}
const fullCoverage = {
  sellability: true, liquidityControl: true, authorityControl: true,
  holderIndependence: true, operatorIdentity: true,
}

describe('historical rug research compatibility bridge', () => {
  it('never pretends historical EVM source is calibrated', () => {
    const signal = historicalRugResearchSignal(input)
    expect(signal.calibration).toBe('UNVERIFIED')
    expect(signal.rugProbability).toBe(0.99)
    expect(signal.evidenceIds).toEqual(['research:source-pin'])
    const verdict = evaluateRugSelfProtection({
      rugProtection: safeCandidate, coverage: fullCoverage,
      modelSignals: [signal], informationCutoff: input.informationCutoff,
    })
    expect(verdict.action).toBe('ALLOW_PAPER_STUDY')
    expect(verdict.modelEscalations).toEqual([])
    expect(verdict.authority).toBe('RESEARCH_ONLY')
    expect(verdict.canAuthorizeTrade).toBe(false)
    expect(verdict.canAuthorizeExit).toBe(false)
  })

  it('marks Solana out-of-domain instead of transferring EVM labels', () => {
    const signal = historicalRugResearchSignal({...input, sourceChain: 'SOL'})
    expect(signal.calibration).toBe('OUT_OF_DOMAIN')
    expect(evaluateRugSelfProtection({
      rugProtection: safeCandidate, coverage: fullCoverage,
      modelSignals: [signal], informationCutoff: input.informationCutoff,
    }).modelEscalations).toEqual([])
  })

  it('cannot lower existing deterministic risk or missing-coverage quarantine', () => {
    const signal = historicalRugResearchSignal({...input, hypothesisScore: 0})
    const blocked:RugProtectionResult = {
      ...safeCandidate, disposition: 'BLOCK', score: 100,
      hardBlockers: ['freeze authority live'],
    }
    const first = evaluateRugSelfProtection({
      rugProtection: blocked, coverage: fullCoverage, modelSignals: [signal],
      informationCutoff: input.informationCutoff,
    })
    expect(first.action).toBe('QUARANTINE')
    expect(first.canLowerDeterministicRisk).toBe(false)
    const second = evaluateRugSelfProtection({
      rugProtection: safeCandidate, coverage: {...fullCoverage, sellability: false},
      modelSignals: [signal], informationCutoff: input.informationCutoff,
    })
    expect(second.action).toBe('QUARANTINE')
  })

  it('rejects time leakage, bad numeric scores, changed source revision and missing evidence', () => {
    expect(() => historicalRugResearchSignal({...input,
      availableAt: '2026-10-15T17:03:00Z',
    })).toThrow('shark_historical_rug_lookahead_blocked')
    expect(() => historicalRugResearchSignal({...input,
      observedAt: '2026-10-15T17:01:30Z',
    })).toThrow('shark_historical_rug_lookahead_blocked')
    expect(() => historicalRugResearchSignal({...input,
      hypothesisScore: Number.NaN,
    })).toThrow('shark_historical_rug_score_invalid')
    expect(() => historicalRugResearchSignal({...input,
      sourceRevision: 'not-pinned',
    })).toThrow('shark_historical_rug_unpinned_source')
    expect(() => historicalRugResearchSignal({...input,
      evidenceIds: [],
    })).toThrow('shark_historical_rug_evidence_required')
    expect(() => historicalRugResearchSignal({...input,
      observedAt: '2026-10-15',
    })).toThrow('shark_historical_rug_observation_time_invalid')
  })
})
