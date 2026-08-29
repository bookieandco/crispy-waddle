import { describe, expect, it } from 'vitest'
import { evaluatePrincipalConfidenceAndRole } from './principal-confidence-role-engine'

const NOW = Date.parse('2026-08-29T12:00:00.000Z')

const basePrincipal = {
  canonicalPrincipalId: 'principal-1',
  identityConfidence: 95,
  roleStatus: 'CURRENT' as const,
  roleConfidence: 90,
}

describe('evaluatePrincipalConfidenceAndRole', () => {
  it('qualifies a strongly corroborated current principal', () => {
    const result = evaluatePrincipalConfidenceAndRole(
      {
        ...basePrincipal,
        evidence: [
          { id: 'e1', providerId: 'registry-a', confidence: 95, observedAt: '2026-08-20T00:00:00Z', role: 'director', independentSourceKey: 'registry-a' },
          { id: 'e2', providerId: 'registry-b', confidence: 90, observedAt: '2026-08-15T00:00:00Z', role: 'director', independentSourceKey: 'registry-b' },
          { id: 'e3', providerId: 'government', confidence: 92, observedAt: '2026-08-10T00:00:00Z', role: 'director', independentSourceKey: 'government' },
        ],
      },
      NOW,
    )

    expect(result.disposition).toBe('QUALIFIED')
    expect(result.identityConfidence).toBeGreaterThanOrEqual(85)
    expect(result.roleConfidence).toBeGreaterThanOrEqual(80)
    expect(result.corroborationScore).toBe(90)
  })

  it('never infers ownership from an officer role', () => {
    const result = evaluatePrincipalConfidenceAndRole(
      {
        ...basePrincipal,
        evidence: [
          { id: 'e1', providerId: 'registry-a', confidence: 95, observedAt: '2026-08-20T00:00:00Z', role: 'CEO', independentSourceKey: 'registry-a' },
          { id: 'e2', providerId: 'registry-b', confidence: 90, observedAt: '2026-08-15T00:00:00Z', role: 'director', independentSourceKey: 'registry-b' },
        ],
      },
      NOW,
    )

    expect(result.ownershipConfidence).toBe(0)
    expect(result.controlConfidence).toBe(0)
    expect(result.reasons.join(' ')).toContain('ownership was not inferred')
  })

  it('requires explicit evidence before scoring ownership and control', () => {
    const result = evaluatePrincipalConfidenceAndRole(
      {
        ...basePrincipal,
        evidence: [
          { id: 'e1', providerId: 'registry-a', confidence: 90, observedAt: '2026-08-20T00:00:00Z', ownershipClaim: true, independentSourceKey: 'registry-a' },
          { id: 'e2', providerId: 'registry-b', confidence: 90, observedAt: '2026-08-15T00:00:00Z', controlClaim: true, independentSourceKey: 'registry-b' },
        ],
      },
      NOW,
    )

    expect(result.ownershipConfidence).toBeGreaterThan(0)
    expect(result.controlConfidence).toBeGreaterThan(0)
  })

  it('flags conflicting evidence', () => {
    const result = evaluatePrincipalConfidenceAndRole(
      {
        ...basePrincipal,
        evidence: [
          { id: 'e1', providerId: 'registry-a', confidence: 95, observedAt: '2026-08-20T00:00:00Z', independentSourceKey: 'registry-a' },
          { id: 'e2', providerId: 'registry-b', confidence: 90, observedAt: '2026-08-15T00:00:00Z', independentSourceKey: 'registry-b', conflict: true },
        ],
      },
      NOW,
    )

    expect(result.disposition).toBe('CONFLICTED')
    expect(result.conflictingEvidenceIds).toEqual(['e2'])
  })

  it('marks very old evidence stale when it is the only evidence', () => {
    const result = evaluatePrincipalConfidenceAndRole(
      {
        ...basePrincipal,
        evidence: [
          { id: 'e1', providerId: 'registry-a', confidence: 90, observedAt: '2023-01-01T00:00:00Z', independentSourceKey: 'registry-a' },
        ],
      },
      NOW,
    )

    expect(result.freshnessScore).toBe(10)
    expect(result.disposition).toBe('STALE')
  })
})
