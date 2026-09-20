import { describe, expect, it } from 'vitest'
import { projectMoneyCommandCenter } from './money-command-center.js'

const entry = (id: string, overall: number, confidence: number) => ({ opportunity: { id, userId: 'u', title: id, description: '', class: 'experiment', strategy: 'digital_product', source: { type: 'commercial', name: 'test' }, evidence: [], economics: { currency: 'USD', startupCost: 10, estimatedHours: 2, recurringRevenue: false }, score: { overall, confidence }, status: 'discovered', requiresApproval: true, createdAt: '2026-08-28T00:00:00.000Z', updatedAt: '2026-08-28T00:00:00.000Z' } as any, rank: 1 })

describe('projectMoneyCommandCenter', () => {
  it('buckets ranked opportunities by deterministic score and evidence confidence', () => {
    const snapshot = projectMoneyCommandCenter([entry('p', 80, .8), entry('t', 60, .5), entry('w', 40, .9)], '2026-08-28T00:00:00.000Z')
    expect(snapshot.totals).toEqual({ found: 3, pursue: 1, test: 1, watch: 1 })
    expect(snapshot.cards.map(c => c.bucket)).toEqual(['pursue', 'test', 'watch'])
    expect(snapshot.cards[0]?.rationale[2]).toContain('Human approval')
  })
})
