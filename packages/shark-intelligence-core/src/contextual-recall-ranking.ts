import type { SharkExperienceWeight } from './experience-ledger'

export type SharkRecallCandidate = SharkExperienceWeight & {
  relationshipStrength: number
  contradictionPenalty?: number
  contextualWeight?: number
}

export type SharkRankedRecall = {
  experienceId: string
  score: number
  rank: number
  contextualWeight: number
}

export function rankSharkContextualRecall(input: {
  candidates: SharkRecallCandidate[]
  limit?: number
}): SharkRankedRecall[] {
  const limit = input.limit ?? input.candidates.length
  if (!Number.isInteger(limit) || limit < 0) throw new Error('limit must be a non-negative integer')
  const scored = input.candidates.map(candidate => {
    if (!Number.isFinite(candidate.relationshipStrength) || candidate.relationshipStrength < 0 || candidate.relationshipStrength > 1) throw new Error('relationship strength must be between 0 and 1')
    const contradiction = candidate.contradictionPenalty ?? 0
    if (!Number.isFinite(contradiction) || contradiction < 0 || contradiction > 1) throw new Error('contradiction penalty must be between 0 and 1')
    const contextualWeight = candidate.contextualWeight ?? 1
    if (!Number.isFinite(contextualWeight) || contextualWeight < 0 || contextualWeight > 1) throw new Error('contextual weight must be between 0 and 1')
    const baseScore = candidate.relevance * 0.35 + candidate.confidence * 0.25 + candidate.recency * 0.15 + candidate.relationshipStrength * 0.25 - contradiction * 0.2
    const score = Math.max(0, Math.min(1, baseScore * contextualWeight))
    return { experienceId: candidate.experienceId, score, contextualWeight }
  })
  return scored
    .sort((a, b) => b.score - a.score || a.experienceId.localeCompare(b.experienceId))
    .slice(0, limit)
    .map((item, index) => ({ ...item, rank: index + 1 }))
}
