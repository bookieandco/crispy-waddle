import { describe, expect, it } from 'vitest'
import { resolvePrincipalIdentity, type PrincipalCandidate } from './principal-identity-resolution'

const base = (overrides: Partial<PrincipalCandidate> = {}): PrincipalCandidate => ({
  id: 'candidate-1',
  corporateEntityId: 'entity-1',
  name: 'Jane Doe',
  role: 'director',
  jurisdiction: 'us_nv',
  providerId: 'opencorporates',
  providerRecordId: 'oc-officer-1',
  registryUid: 'NV-123',
  corporateIdentifier: 'NV-999',
  sourceRecordId: 'source-1',
  evidenceIds: ['evidence-1'],
  startDate: '2024-01-01',
  endDate: null,
  ...overrides,
})

describe('resolvePrincipalIdentity', () => {
  it('matches an exact provider identifier', () => {
    const result = resolvePrincipalIdentity([base()], {
      corporateEntityId: 'entity-1',
      jurisdiction: 'us_nv',
      canonicalName: 'Jane Doe',
    })

    expect(result.status).toBe('MATCHED')
    expect(result.identityConfidence).toBe(98)
    expect(result.matchedCandidateIds).toEqual(['candidate-1'])
  })

  it('matches using normalized name, jurisdiction, and role when no identifiers exist', () => {
    const result = resolvePrincipalIdentity([
      base({ providerRecordId: null, registryUid: null, corporateIdentifier: null, name: '  Jáné   Doe ' }),
    ], {
      corporateEntityId: 'entity-1',
      jurisdiction: 'us_nv',
      expectedRole: 'Director',
      canonicalName: 'Jane Doe',
    })

    expect(result.status).toBe('MATCHED')
    expect(result.roleStatus).toBe('CURRENT')
    expect(result.roleConfidence).toBe(95)
  })

  it('does not match a name-only candidate', () => {
    const result = resolvePrincipalIdentity([
      base({ providerRecordId: null, registryUid: null, corporateIdentifier: null, jurisdiction: null, role: null }),
    ], {
      corporateEntityId: 'entity-1',
      canonicalName: 'Jane Doe',
    })

    expect(result.status).toBe('UNMATCHED')
    expect(result.canonicalPrincipalId).toBeNull()
  })

  it('flags materially ambiguous candidates', () => {
    const result = resolvePrincipalIdentity([
      base({ id: 'candidate-a', providerRecordId: null, registryUid: null, corporateIdentifier: null }),
      base({ id: 'candidate-b', providerRecordId: null, registryUid: null, corporateIdentifier: null, name: 'Jane Doe', role: 'secretary' }),
    ], {
      corporateEntityId: 'entity-1',
      jurisdiction: 'us_nv',
      canonicalName: 'Jane Doe',
    })

    expect(result.status).toBe('AMBIGUOUS')
    expect(result.matchedCandidateIds).toEqual([])
  })

  it('marks a principal former when the officership has ended', () => {
    const result = resolvePrincipalIdentity([
      base({ endDate: '2020-01-01' }),
    ], {
      corporateEntityId: 'entity-1',
      canonicalName: 'Jane Doe',
    }, new Date('2026-08-28T00:00:00Z'))

    expect(result.status).toBe('MATCHED')
    expect(result.roleStatus).toBe('FORMER')
  })

  it('preserves evidence IDs from every candidate', () => {
    const result = resolvePrincipalIdentity([
      base({ evidenceIds: ['evidence-1', 'evidence-2'] }),
      base({ id: 'candidate-2', providerId: 'state-registry', providerRecordId: 'state-1', evidenceIds: ['evidence-3'] }),
    ], {
      corporateEntityId: 'entity-1',
      canonicalName: 'Jane Doe',
    })

    expect(result.supportingEvidenceIds).toEqual(expect.arrayContaining(['evidence-1', 'evidence-2', 'evidence-3']))
  })
})
