import { describe, expect, it } from 'vitest'
import { createMeasurementIdentity, isValidMeasurementEvent } from './measurement-hooks.js'

describe('Creative measurement hooks', () => {
  it('creates deterministic attribution identity', () => {
    const identity = createMeasurementIdentity({ opportunityId: 'opp-1', creativeDnaId: 'dna-1', variantId: 'dna-1:1', channel: 'tiktok' })
    expect(identity.measurementId).toBe('opp-1:dna-1:1:tiktok')
  })

  it('accepts measurable events with finite values and lineage', () => {
    const identity = createMeasurementIdentity({ opportunityId: 'opp-1', creativeDnaId: 'dna-1', variantId: 'dna-1:1', channel: 'tiktok' })
    expect(isValidMeasurementEvent({ identity, metric: 'clicks', value: 12, occurredAt: '2026-08-28T00:00:00Z' })).toBe(true)
    expect(isValidMeasurementEvent({ identity, metric: 'revenue', value: Number.NaN, occurredAt: '2026-08-28T00:00:00Z' })).toBe(false)
  })
})
