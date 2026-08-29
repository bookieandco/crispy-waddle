import { certifySharkPaperReadiness, type SharkReadinessCertification, type SharkReadinessEvidence } from './readiness-certification'

export type SharkAssessmentReadinessInput = {
  assessmentId: string
  knowledgeVersion: number
  evidence: SharkReadinessEvidence
}

export type SharkAssessmentReadinessResult = SharkReadinessCertification & {
  assessmentId: string
  knowledgeVersion: number
}

export function certifySharkAssessmentReadiness(input: SharkAssessmentReadinessInput): SharkAssessmentReadinessResult {
  if (!input.assessmentId.trim()) throw new Error('assessment id is required')
  if (!Number.isInteger(input.knowledgeVersion) || input.knowledgeVersion < 1) throw new Error('knowledge version must be a positive integer')

  const certification = certifySharkPaperReadiness(input.evidence)
  return {
    ...certification,
    assessmentId: input.assessmentId,
    knowledgeVersion: input.knowledgeVersion,
  }
}
