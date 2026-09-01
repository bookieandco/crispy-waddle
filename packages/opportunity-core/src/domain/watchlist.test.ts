import { describe, expect, it } from 'vitest'
import { createAlertEvent, fingerprintAlert, isDuplicateAlert, type WatchlistEntry, type WatchlistEvaluation } from './watchlist.js'

const entry: WatchlistEntry = { id: 'watch-1', opportunityId: 'opp-1', principalId: 'principal-1', enabled: true, createdAt: '2026-08-30T00:00:00Z' }
const evaluation: WatchlistEvaluation = { type: 'OPPORTUNITY_CHANGED', priority: 'HIGH', changeReason: 'deadline changed', previousState: { deadline: '2026-09-01' }, newState: { deadline: '2026-09-15' }, supportingEvidenceIds: ['ev-1'] }

describe('OCE-6.74 watchlist alerts', () => {
  it('creates deterministic fingerprints', () => {
    expect(fingerprintAlert(entry, evaluation)).toBe(fingerprintAlert(entry, evaluation))
  })

  it('is invariant to nested object key order', () => {
    const left = { ...evaluation, previousState: { deadline: '2026-09-01', meta: { b: 2, a: 1 } } }
    const right = { ...evaluation, previousState: { meta: { a: 1, b: 2 }, deadline: '2026-09-01' } }
    expect(fingerprintAlert(entry, left)).toBe(fingerprintAlert(entry, right))
  })

  it('preserves array order as material state', () => {
    const left = { ...evaluation, newState: { ids: ['a', 'b'] } }
    const right = { ...evaluation, newState: { ids: ['b', 'a'] } }
    expect(fingerprintAlert(entry, left)).not.toBe(fingerprintAlert(entry, right))
  })

  it('creates provenance-preserving alert events', () => {
    const alert = createAlertEvent(entry, evaluation, '2026-08-30T12:00:00Z')
    expect(alert.opportunityId).toBe('opp-1')
    expect(alert.principalId).toBe('principal-1')
    expect(alert.supportingEvidenceIds).toEqual(['ev-1'])
    expect(alert.engineVersion).toBe('6.74.0')
  })

  it('deduplicates an identical alert fingerprint', () => {
    const alert = createAlertEvent(entry, evaluation, '2026-08-30T12:00:00Z')
    expect(isDuplicateAlert([alert], alert)).toBe(true)
  })

  it('does not treat a different material change as a duplicate', () => {
    const alert = createAlertEvent(entry, evaluation, '2026-08-30T12:00:00Z')
    const changed = createAlertEvent(entry, { ...evaluation, newState: { deadline: '2026-10-01' } }, '2026-08-30T12:01:00Z')
    expect(isDuplicateAlert([alert], changed)).toBe(false)
  })
})
