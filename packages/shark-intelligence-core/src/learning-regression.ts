export type SharkLearningSnapshot = {
  knowledgeId: string
  version: number
  confidence: number
  performanceScore: number
  riskScore: number
  sampleSize: number
  provenanceComplete: boolean
  simulated: true
}

export type SharkLearningUpdate = SharkLearningSnapshot & {
  accepted: boolean
  reasons: string[]
}

export function evaluateSharkLearningUpdate(input: {
  previous: SharkLearningSnapshot
  candidate: SharkLearningSnapshot
  minimumConfidence?: number
  maximumPerformanceRegression?: number
  maximumRiskRegression?: number
}): SharkLearningUpdate {
  const minimumConfidence = input.minimumConfidence ?? 0.7
  const maximumPerformanceRegression = input.maximumPerformanceRegression ?? 0.1
  const maximumRiskRegression = input.maximumRiskRegression ?? 0.1
  const reasons: string[] = []
  if (input.candidate.knowledgeId !== input.previous.knowledgeId) reasons.push('knowledge identity changed')
  if (input.candidate.version <= input.previous.version) reasons.push('candidate version is not newer')
  if (input.candidate.confidence < minimumConfidence) reasons.push('candidate confidence below threshold')
  if (input.candidate.performanceScore < input.previous.performanceScore - maximumPerformanceRegression) reasons.push('performance regression exceeded threshold')
  if (input.candidate.riskScore < input.previous.riskScore - maximumRiskRegression) reasons.push('risk stability regression exceeded threshold')
  if (input.candidate.sampleSize < input.previous.sampleSize) reasons.push('candidate sample size decreased')
  if (!input.candidate.provenanceComplete) reasons.push('incomplete provenance')

  return {
    ...input.candidate,
    accepted: reasons.length === 0,
    reasons,
  }
}
