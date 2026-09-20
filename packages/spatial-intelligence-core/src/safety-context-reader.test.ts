import { describe, expect, it } from 'vitest';
import { SpatialSafetyContextReader } from './safety-context-reader.js';

describe('SpatialSafetyContextReader', () => {
  it('projects admitted spatial context to safety without execution authority', async () => {
    const reader = new SpatialSafetyContextReader({
      read: async () => ({
        subject: 'drill',
        geographicScope: null,
        temporalScope: { from: null, to: null, asOf: '2026-09-20T17:00:00Z' },
        observations: [{ id: 'o1', source: 'gev', observedAt: '2026-09-20T17:00:00Z', summary: 'road closure' }],
        evidence: [{ id: 'e1', source: 'gev', observedAt: '2026-09-20T17:00:01Z', summary: 'confirmed closure' }],
        claims: [],
        reality: [{ id: 'r1', source: 'reality', observedAt: '2026-09-20T17:00:02Z', summary: 'closure admitted' }],
        patterns: [],
        predictions: [],
        scenarios: [],
        hypotheses: [],
        sourceHealth: [],
        conflicts: [],
        uncertainty: [],
        limitations: [],
        workspaceRef: null,
        investigationRef: null,
        provenance: [],
      }),
    });
    const records = await reader.readForSafety('incident', '2026-09-20T17:01:00Z');
    expect(records.some((record) => record.determination === 'verified')).toBe(true);
    expect(records.every((record) => record.payload.authority === 'INTELLIGENCE_ONLY')).toBe(true);
  });
});
