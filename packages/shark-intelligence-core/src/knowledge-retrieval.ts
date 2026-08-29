export type SharkKnowledgeRecord = {
  knowledgeId: string
  strategyId: string
  stage: 'candidate' | 'training' | 'validated' | 'usable_for_assessment'
  scenarioTags: string[]
  confidence: number
  sampleSize: number
  provenanceComplete: boolean
}

export type SharkKnowledgeMatch = SharkKnowledgeRecord & {
  relevanceScore: number
  usable: boolean
}

export function retrieveSharkKnowledge(input: {
  records: SharkKnowledgeRecord[]
  strategyId?: string
  scenarioTags?: string[]
  minimumConfidence?: number
  minimumSampleSize?: number
}): SharkKnowledgeMatch[] {
  const minimumConfidence = input.minimumConfidence ?? 0
  const minimumSampleSize = input.minimumSampleSize ?? 0
  if (minimumConfidence < 0 || minimumConfidence > 1) throw new Error('minimum confidence must be between 0 and 1')
  if (minimumSampleSize < 0) throw new Error('minimum sample size must be non-negative')

  return input.records
    .filter(record => record.stage === 'usable_for_assessment')
    .filter(record => !input.strategyId || record.strategyId === input.strategyId)
    .filter(record => record.confidence >= minimumConfidence)
    .filter(record => record.sampleSize >= minimumSampleSize)
    .filter(record => record.provenanceComplete)
    .map(record => {
      const requestedTags = new Set(input.scenarioTags ?? [])
      const matchingTags = record.scenarioTags.filter(tag => requestedTags.has(tag)).length
      const relevanceScore = requestedTags.size === 0 ? record.confidence : matchingTags / requestedTags.size
      return { ...record, relevanceScore, usable: relevanceScore > 0 || requestedTags.size === 0 }
    })
    .filter(record => record.usable)
    .sort((a, b) => b.relevanceScore - a.relevanceScore || b.confidence - a.confidence || b.sampleSize - a.sampleSize)
}
