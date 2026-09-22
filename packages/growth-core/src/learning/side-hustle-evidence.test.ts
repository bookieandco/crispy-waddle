import { describe, expect, it } from 'vitest'
import { buildGrowthSideHustleEvidenceReceipt } from './side-hustle-evidence.js'

describe('buildGrowthSideHustleEvidenceReceipt', () => {
  it('keeps Growth correlation and actual spend without inventing business semantics', () => {
    const receipt = buildGrowthSideHustleEvidenceReceipt({
      measurement: {
        requestId: 'growth-request:1',
        opportunityId: 'opportunity:1',
        executionId: 'growth-execution:1',
        status: 'SUCCEEDED',
        plannedSpend: 50,
        actualSpend: 37.5,
        plannedResourceUnits: 5,
        actualResourceUnits: 4,
      },
      experimentId: 'experiment:1',
      metrics: {
        qualified_conversations: 2,
        paid_commitments: 1,
        serious_fit_blockers: 0,
      },
      hours: 1.25,
      evidenceRefs: ['growth-attribution:1'],
      observedAt: '2026-09-22T16:30:00.000Z',
    })

    expect(receipt.opportunityId).toBe('opportunity:1')
    expect(receipt.experimentId).toBe('experiment:1')
    expect(receipt.sourceOwner).toBe('growth')
    expect(receipt.sourceRecordId).toBe('growth-request:1')
    expect(receipt.spend).toBe(37.5)
    expect(receipt.hours).toBe(1.25)
    expect(receipt.executionRef).toBe('growth-execution:1')
    expect(receipt.metrics).toEqual({
      qualified_conversations: 2,
      paid_commitments: 1,
      serious_fit_blockers: 0,
    })
  })

  it('rejects missing evidence instead of manufacturing source proof', () => {
    expect(() => buildGrowthSideHustleEvidenceReceipt({
      measurement: {
        requestId: 'growth-request:2',
        opportunityId: 'opportunity:2',
        status: 'SUCCEEDED',
        plannedSpend: 25,
        actualSpend: 20,
        plannedResourceUnits: 2,
        actualResourceUnits: 2,
      },
      metrics: { qualified_conversations: 1 },
      hours: 1,
      evidenceRefs: [],
      observedAt: '2026-09-22T16:30:00.000Z',
    })).toThrow(/non-empty evidence references/)
  })
})
