import { assessWithSharkKnowledge, type SharkKnowledgeBackedAssessment } from './knowledge-backed-assessment'
import { evaluateSharkScenarioGeneralization, type SharkScenario } from './scenario-generalization'
import type { SharkKnowledgeMatch } from './knowledge-retrieval'

export type SharkGeneralizationBackedAssessment = SharkKnowledgeBackedAssessment & {
  generalization: ReturnType<typeof evaluateSharkScenarioGeneralization>
}

export function assessWithGeneralizedSharkKnowledge(input: {
  assessmentId: string
  opportunityId: string
  strategyId: string
  knowledge: SharkKnowledgeMatch[]
  trainingScenarios: SharkScenario[]
  candidateScenario: SharkScenario
  uncertainty?: number
}): SharkGeneralizationBackedAssessment {
  const base = assessWithSharkKnowledge(input)
  const generalization = evaluateSharkScenarioGeneralization({
    trainingScenarios: input.trainingScenarios,
    candidate: input.candidateScenario,
  })

  if (base.status === 'INSUFFICIENT_KNOWLEDGE' || base.status === 'KNOWLEDGE_CONFLICT') {
    return { ...base, generalization }
  }

  if (generalization.status !== 'GENERALIZED') {
    return {
      ...base,
      status: 'ASSESSMENT_WITH_UNCERTAINTY',
      uncertainty: Math.max(base.uncertainty, 1 - generalization.similarityScore),
      generalization,
    }
  }

  return { ...base, generalization }
}
