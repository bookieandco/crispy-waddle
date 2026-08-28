import { describe, expect, it } from 'vitest'
import type { Opportunity } from './sideIncome'
import type { MoneyActionItem } from '@/lib/money-opportunities/action-queue'
import { buildResearchCasePlan, persistResearchCasePlan, type ResearchPersistence } from './research'

const opportunity: Opportunity = {
  id: 'sam_123',
  userId: 'user_1',
  title: 'IT services',
  kind: 'automation',
  sourceUrl: 'https://sam.gov/opp/123/view',
  sourceName: 'SAM.gov',
  summary: 'Test opportunity',
  estimatedPay: { min: 100000, max: 150000, currency: 'USD', cadence: 'per_project' },
  automationLevel: 'ai_plus_user',
  fitScore: 80,
  riskFlags: [],
  deadline: '2026-09-10T00:00:00Z',
  requiresUserApproval: true,
  verificationStatus: 'human_required',
  sourceConfidence: 0.95,
  status: 'new',
  createdAt: '2026-08-28T00:00:00Z',
}

const action: MoneyActionItem = {
  opportunityId: opportunity.id,
  action: 'BID_NOW',
  priority: 'HIGH',
  deadline: opportunity.deadline,
  estimatedValue: 150000,
  estimatedMarginPercent: 25,
  capabilityGap: false,
  rationale: ['test'],
}

describe('Opportunity Hub research boundary', () => {
  it('creates a deterministic case and required verification tasks', () => {
    const plan = buildResearchCasePlan(opportunity, action, '2026-08-28T15:00:00Z')

    expect(plan.researchCase.id).toBe('research_sam_123')
    expect(plan.researchCase.status).toBe('PENDING')
    expect(plan.researchCase.action).toBe('BID_NOW')
    expect(plan.tasks.map((task) => task.kind)).toEqual([
      'VERIFY_SOURCE',
      'VERIFY_ECONOMICS',
      'VERIFY_REQUIREMENTS',
      'VERIFY_DEADLINE',
      'ASSESS_CAPABILITY',
      'ASSESS_COMPETITION',
    ])
    expect(plan.tasks.every((task) => task.status === 'PENDING' && task.required)).toBe(true)
  })

  it('adds partner research only when the action requires a partner', () => {
    const partnerAction = { ...action, action: 'FIND_PARTNER' as const, capabilityGap: true }
    const plan = buildResearchCasePlan(opportunity, partnerAction, '2026-08-28T15:00:00Z')

    expect(plan.tasks.map((task) => task.kind)).toContain('FIND_PARTNER')
    expect(plan.tasks.map((task) => task.kind)).not.toContain('ASSESS_COMPETITION')
  })

  it('persists the case before its tasks through the storage boundary', async () => {
    const calls: string[] = []
    const persistence: ResearchPersistence = {
      async upsertCase() { calls.push('case') },
      async upsertTasks() { calls.push('tasks') },
    }

    await persistResearchCasePlan(persistence, buildResearchCasePlan(opportunity, action, '2026-08-28T15:00:00Z'))
    expect(calls).toEqual(['case', 'tasks'])
  })
})
