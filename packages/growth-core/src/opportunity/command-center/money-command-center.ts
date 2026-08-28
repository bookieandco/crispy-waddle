import type { Opportunity } from '../domain/opportunity.js'
import type { QueueEntry } from '../queue/canonical-opportunity-queue.js'

export type MoneyCommandBucket = 'pursue' | 'test' | 'watch'
export type MoneyCommandCenterCard = { opportunity: Opportunity; rank: number; bucket: MoneyCommandBucket; evidenceConfidence: number; rationale: string[] }
export type MoneyCommandCenterSnapshot = { generatedAt: string; totals: { found: number; pursue: number; test: number; watch: number }; cards: MoneyCommandCenterCard[] }

export function projectMoneyCommandCenter(entries: readonly QueueEntry[], generatedAt = new Date().toISOString()): MoneyCommandCenterSnapshot {
  const cards = entries.map(({ opportunity, rank }) => {
    const score = opportunity.score?.overall ?? 0
    const evidenceConfidence = opportunity.score?.confidence ?? 0
    const bucket: MoneyCommandBucket = score >= 75 && evidenceConfidence >= 0.7 ? 'pursue' : score >= 50 && evidenceConfidence >= 0.45 ? 'test' : 'watch'
    return { opportunity, rank, bucket, evidenceConfidence, rationale: [`Opportunity score: ${score}`, `Evidence confidence: ${evidenceConfidence}`, opportunity.requiresApproval ? 'Human approval required before external action.' : 'No external action approval flag set.'] }
  })
  return { generatedAt, totals: { found: cards.length, pursue: cards.filter(c => c.bucket === 'pursue').length, test: cards.filter(c => c.bucket === 'test').length, watch: cards.filter(c => c.bucket === 'watch').length }, cards }
}
