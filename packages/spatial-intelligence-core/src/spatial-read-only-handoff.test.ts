import { describe, expect, it } from 'vitest'
import type { SpatialContextPackage } from './integration.js'
import { projectSpatialReadOnlyHandoff, type SpatialReadOnlyConsumer } from './spatial-read-only-handoff.js'

const now = '2026-10-16T20:00:00.000Z'
const fixture = (): SpatialContextPackage => ({
  subject: 'regional earthquake observation', geographicScope: { lat: 34, lon: -118 },
  temporalScope: { from: null, to: null, asOf: now },
  observations: [{ id: 'usgs:observation:1', source: 'USGS', observedAt: now, summary: 'raw source context', immutable: false }],
  evidence: [], claims: [], reality: [], patterns: [], predictions: [], scenarios: [], hypotheses: [],
  sourceHealth: ['earthquake:available:1'],
  conflicts: [], uncertainty: ['not independently verified'],
  limitations: ['Observational only'], workspaceRef: null, investigationRef: null, provenance: [],
})

describe('GEV-LIVE.10 reference-only cross-system acceptance', () => {
  const consumers: SpatialReadOnlyConsumer[] = ['delia', 'director', 'safety', 'money', 'sports', 'opportunity', 'research']
  for (const consumer of consumers) {
    it(`${consumer}: observations cannot authorize actions, inference or Reality`, () => {
      const source = fixture()
      const projected = projectSpatialReadOnlyHandoff(source, consumer)
      expect(projected.consumer).toBe(consumer)
      expect(projected.authority).toBe('READ_ONLY_CONTEXT')
      expect(projected.observedRefs).toEqual(['usgs:observation:1'])
      expect(projected.durableEvidenceRefs).toEqual([])
      expect(projected.admittedRealityRefs).toEqual([])
      expect(projected.evidenceGaps).toContain('NO_DURABLE_EVIDENCE')
      expect(projected.evidenceGaps).toContain('NO_ADMITTED_REALITY')
      expect(projected.actionable).toBe(false)
      expect(projected.writeAllowed).toBe(false)
      expect(projected.canTrade).toBe(false)
      expect(projected.canWager).toBe(false)
      expect(projected.canPublish).toBe(false)
      expect(projected.canObservePrivateFeeds).toBe(false)
      expect(projected.verifiedForOperationalUse).toBe(false)
      expect(JSON.stringify(projected)).not.toContain('34,')
      expect(JSON.stringify(projected)).not.toContain('raw source context')
    })
  }
  it('separates independently admitted IDs from observations and durable evidence IDs', () => {
    const pkg = fixture()
    pkg.evidence = [{ id: 'gev:evidence:1', source: 'USGS', observedAt: now, summary: 'readback', immutable: true }]
    pkg.reality = [{ id: 'spatial:admission:1', source: 'admission', observedAt: now, summary: 'accepted', immutable: true }]
    const projected = projectSpatialReadOnlyHandoff(pkg, 'director')
    expect(projected.observedRefs).toEqual(['usgs:observation:1'])
    expect(projected.durableEvidenceRefs).toEqual(['gev:evidence:1'])
    expect(projected.admittedRealityRefs).toEqual(['spatial:admission:1'])
    expect(projected.verifiedForOperationalUse).toBe(false)
    expect(projected.actionable).toBe(false)
  })
  it('does not leak nested source payloads or accept unbounded/untrusted reference IDs', () => {
    const pkg = fixture()
    pkg.observations.push({
      id: 'data:text/html;base64,TOKEN', source: 'provider;password=SUPER_SECRET',
      observedAt: now, summary: 'SUPER_SECRET', immutable: false,
    })
    pkg.sourceHealth = ['earthquake:available:1', 'x'.repeat(500)]
    const projected = projectSpatialReadOnlyHandoff(pkg, 'money')
    expect(projected.observedRefs).toEqual(['usgs:observation:1'])
    expect(projected.sourceHealth).toEqual(['earthquake:available:1'])
    expect(JSON.stringify(projected)).not.toContain('SUPER_SECRET')
    expect(JSON.stringify(projected)).not.toContain('TOKEN')
  })
  it('rejects unknown consumers rather than granting a generic adapter', () => {
    expect(() => projectSpatialReadOnlyHandoff(fixture(), 'executor' as SpatialReadOnlyConsumer))
      .toThrow('SPATIAL_HANDOFF_CONSUMER_UNSUPPORTED')
  })
})
