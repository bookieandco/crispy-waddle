import { describe, expect, it } from 'vitest'
import { createSpatialRealityAdmissionReadProvider } from './spatial-reality-admission-read-provider.js'
import type { SpatialContextPackage } from './integration.js'
import type { SpatialQueryPlan } from './spatial-pipeline.js'
import type { SpatialEvidenceStore } from './evidence-store.js'
import type { SpatialRealityStore } from './reality.js'
import type { SpatialTelemetryEvent } from './spatial-telemetry.js'

describe('GEV admission failure is safe for Ask model input', () => {
  it('does not disclose a privileged persistence error or create an admitted Reality ref', async () => {
    const secret = 'SUPABASE_SERVICE_ROLE_KEY=never-copy-this'
    const events: SpatialTelemetryEvent[] = []
    const pkg: SpatialContextPackage = {
      subject: 'airport', geographicScope: null,
      temporalScope: { from: null, to: null, asOf: null },
      observations: [],
      evidence: [{ id: 'evidence:1', source: 'test', observedAt: '2026-10-14T12:00:00Z', summary: 'test', immutable: true }],
      claims: [], reality: [], patterns: [], predictions: [], scenarios: [], hypotheses: [],
      sourceHealth: [], conflicts: [], uncertainty: [], limitations: [],
      workspaceRef: null, investigationRef: null, provenance: [],
    }
    const store = {
      get: async () => { throw new Error('internal URL; ' + secret) },
      append: async () => 'APPENDED',
    } as unknown as SpatialEvidenceStore
    const admissionStore = {} as SpatialRealityStore
    const provider = createSpatialRealityAdmissionReadProvider({
      read: { read: async () => pkg },
      evidenceStore: store,
      realityStore: admissionStore,
      telemetry: { record: event => { events.push(event) } },
    })

    const result = await provider.read({} as SpatialQueryPlan, 'owner')
    expect(result?.reality).toEqual([])
    expect(result?.limitations.some(text => text.includes('failed closed'))).toBe(true)
    expect(JSON.stringify(result)).not.toContain(secret)
    expect(JSON.stringify(events)).not.toContain(secret)
    expect(events[0]?.details.errorCode).toBe('SPATIAL_REALITY_ADMISSION_FAILURE')
  })
})
