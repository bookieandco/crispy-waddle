import { certifySharkAssessmentReadiness } from './assessment-readiness'

describe('SHARK 1.37 readiness certification', () => {
  const base = {
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

  it('passes only complete paper evidence', () => {
    const result = certifySharkAssessmentReadiness({ assessmentId: 'a-137', knowledgeVersion: 4, evidence: base })
    expect(result.status).toBe('READY_FOR_LIVE_REVIEW')
    expect(result.simulated).toBe(true)
    expect(result.paperOnly).toBe(true)
  })

  for (const [field, expected] of Object.entries({
    knowledgeValidated: 'INSUFFICIENT_EVIDENCE',
    confidenceCalibrated: 'INSUFFICIENT_EVIDENCE',
    outOfSampleValidated: 'INSUFFICIENT_EVIDENCE',
    riskReconciled: 'NOT_READY',
    accountingReconciled: 'NOT_READY',
    attributionReconciled: 'NOT_READY',
    regressionProtectionPassed: 'NOT_READY',
    provenanceComplete: 'NOT_READY',
    humanReviewComplete: 'NOT_READY',
  })) {
    it(`fails closed when ${field} is false`, () => {
      const result = certifySharkAssessmentReadiness({
        assessmentId: `a-${field}`,
        knowledgeVersion: 4,
        evidence: { ...base, [field]: false },
      })
      expect(result.status).toBe(expected)
      expect(result.reasons.length).toBeGreaterThan(0)
      expect(result.simulated).toBe(true)
    })
  }
})
