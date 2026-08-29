import { certifySharkAssessmentReadiness } from './assessment-readiness'

describe('certifySharkAssessmentReadiness', () => {
  const completeEvidence = {
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

  it('derives readiness from assessment evidence', () => {
    const result = certifySharkAssessmentReadiness({
      assessmentId: 'assessment-1',
      knowledgeVersion: 3,
      evidence: completeEvidence,
    })
    expect(result.status).toBe('READY_FOR_LIVE_REVIEW')
    expect(result.assessmentId).toBe('assessment-1')
    expect(result.knowledgeVersion).toBe(3)
    expect(result.simulated).toBe(true)
  })

  it('fails closed when assessment evidence is incomplete', () => {
    const result = certifySharkAssessmentReadiness({
      assessmentId: 'assessment-2',
      knowledgeVersion: 3,
      evidence: { ...completeEvidence, accountingReconciled: false },
    })
    expect(result.status).toBe('NOT_READY')
    expect(result.reasons).toContain('accounting reconciliation is incomplete')
  })

  it('rejects invalid assessment identity', () => {
    expect(() => certifySharkAssessmentReadiness({
      assessmentId: ' ',
      knowledgeVersion: 1,
      evidence: completeEvidence,
    })).toThrow('assessment id is required')
  })
})
