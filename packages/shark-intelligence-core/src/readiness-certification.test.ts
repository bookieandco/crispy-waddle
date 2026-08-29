import { certifySharkPaperReadiness } from './readiness-certification'

describe('certifySharkPaperReadiness', () => {
  const passing = {
    knowledgeValidated: true,
    confidenceCalibrated: true,
    outOfSampleValidated: true,
    riskReconciled: true,
    accountingReconciled: true,
    attributionReconciled: true,
    regressionProtectionPassed: true,
    provenanceComplete: true,
    humanReviewComplete: true,
    paperOnly: true as const,
  }

  it('requires all evidence before live review readiness', () => {
    expect(certifySharkPaperReadiness(passing).status).toBe('READY_FOR_LIVE_REVIEW')
  })

  it('cannot certify without knowledge validation', () => {
    const result = certifySharkPaperReadiness({ ...passing, knowledgeValidated: false })
    expect(result.status).toBe('INSUFFICIENT_EVIDENCE')
    expect(result.reasons).toContain('knowledge is not validated')
  })

  it('cannot certify stale or incomplete confidence evidence', () => {
    const result = certifySharkPaperReadiness({ ...passing, confidenceCalibrated: false, outOfSampleValidated: false })
    expect(result.status).toBe('INSUFFICIENT_EVIDENCE')
    expect(result.reasons).toEqual(expect.arrayContaining(['confidence is not calibrated', 'out-of-sample validation is incomplete']))
  })

  it('blocks readiness when accounting, risk, or attribution fails', () => {
    const result = certifySharkPaperReadiness({ ...passing, accountingReconciled: false, riskReconciled: false, attributionReconciled: false })
    expect(result.status).toBe('NOT_READY')
    expect(result.reasons).toEqual(expect.arrayContaining([
      'accounting reconciliation is incomplete',
      'risk reconciliation is incomplete',
      'attribution reconciliation is incomplete',
    ]))
  })

  it('blocks readiness without provenance or human review', () => {
    const result = certifySharkPaperReadiness({ ...passing, provenanceComplete: false, humanReviewComplete: false })
    expect(result.status).toBe('NOT_READY')
    expect(result.reasons).toEqual(expect.arrayContaining(['provenance is incomplete', 'human review is incomplete']))
  })

  it('always remains explicitly simulated', () => {
    const result = certifySharkPaperReadiness(passing)
    expect(result.simulated).toBe(true)
    expect(result.paperOnly).toBe(true)
  })
})
