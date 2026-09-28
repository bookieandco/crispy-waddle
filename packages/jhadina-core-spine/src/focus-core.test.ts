import { describe, expect, it } from 'vitest'
import { assessFocus, assessFocusInterruption, type FocusWorkItem } from './focus-core.js'

const objective = 'launch:pupsonstuff'

const item = (overrides: Partial<FocusWorkItem>): FocusWorkItem => ({
  id: 'item',
  objectiveRef: objective,
  label: 'work',
  classification: 'progress',
  requiresOwner: false,
  estimatedHours: 1,
  progressContribution: 0.5,
  dependencyUnlock: 0.5,
  urgency: 0.5,
  evidenceRefs: ['evidence:1'],
  ...overrides,
})

describe('focus core', () => {
  it('separates owner attention from system bottleneck and tracks maintenance share', () => {
    const result = assessFocus({
      objectiveRef: objective,
      items: [
        item({ id: 'owner-approval', requiresOwner: true, dependencyUnlock: 0.9, progressContribution: 0.7 }),
        item({ id: 'system-test', dependencyUnlock: 1, progressContribution: 0.9 }),
        item({ id: 'maintenance', classification: 'maintenance', estimatedHours: 2, dependencyUnlock: 0.1 }),
        item({ id: 'experiment', classification: 'exploration', dependencyUnlock: 0.2 }),
      ],
    })
    expect(result.primaryOwnerItemId).toBe('owner-approval')
    expect(result.systemBottleneckItemId).toBe('system-test')
    expect(result.maintenanceShare).toBeGreaterThan(0)
    expect(result.deferredItemIds).toContain('experiment')
    expect(result.authority).toBe('PRIORITIZATION_ONLY')
  })

  it('treats a higher-leverage same-objective item as superseding without granting authority', () => {
    const result = assessFocusInterruption({
      current: item({ id: 'current', requiresOwner: true, dependencyUnlock: 0.4 }),
      candidate: item({ id: 'candidate', requiresOwner: true, dependencyUnlock: 0.9 }),
      candidateDeadlineMaterial: false,
      candidateInvalidatesCurrentPlan: false,
    })
    expect(result.disposition).toBe('superseding')
    expect(result.authorizationEffect).toBe('NONE')
  })

  it('keeps unrelated work out of the locked objective by default', () => {
    const result = assessFocusInterruption({
      current: item({ id: 'current' }),
      candidate: item({ id: 'other', objectiveRef: 'director:experiment' }),
      candidateDeadlineMaterial: false,
      candidateInvalidatesCurrentPlan: false,
    })
    expect(result.disposition).toBe('distraction')
  })
})
