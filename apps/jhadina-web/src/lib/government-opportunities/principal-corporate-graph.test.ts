import { describe, expect, it } from 'vitest'
import { buildPrincipalCorporateGraph, getCorporatePrincipals, getPrincipalRelationships } from './principal-corporate-graph'

const principal = { id: 'p-1', type: 'PRINCIPAL' as const, canonicalId: 'principal-1', displayName: 'Jane Smith' }
const company = { id: 'c-1', type: 'CORPORATE_ENTITY' as const, canonicalId: 'company-1', displayName: 'Example LLC', jurisdiction: 'us_nv' }

const evidence = [{ evidenceId: 'e-1', providerId: 'opencorporates', sourceRecordId: 'oc-1', confidence: 92 }]

describe('buildPrincipalCorporateGraph', () => {
  it('creates distinct principal and corporate nodes with an officer edge', () => {
    const graph = buildPrincipalCorporateGraph([{ principal, corporateEntity: company, relationshipType: 'OFFICER_OF', status: 'CURRENT', confidence: 91, evidence }])
    expect(graph.nodes).toHaveLength(2)
    expect(graph.edges).toHaveLength(1)
    expect(graph.edges[0]).toMatchObject({ subjectId: 'p-1', objectId: 'c-1', relationshipType: 'OFFICER_OF', status: 'CURRENT', confidence: 91 })
  })

  it('deduplicates repeated relationships while preserving evidence', () => {
    const graph = buildPrincipalCorporateGraph([
      { principal, corporateEntity: company, relationshipType: 'OFFICER_OF', confidence: 70, evidence },
      { principal, corporateEntity: company, relationshipType: 'OFFICER_OF', confidence: 88, evidence: [{ evidenceId: 'e-2', providerId: 'sec', confidence: 95 }] },
    ])
    expect(graph.edges).toHaveLength(1)
    expect(graph.edges[0].confidence).toBe(88)
    expect(graph.edges[0].evidenceIds).toEqual(['e-1', 'e-2'])
  })

  it('keeps ownership/control as explicit relationship types rather than inferring them from officer status', () => {
    const graph = buildPrincipalCorporateGraph([
      { principal, corporateEntity: company, relationshipType: 'OFFICER_OF', confidence: 90, evidence },
      { principal, corporateEntity: company, relationshipType: 'OWNER_OF', confidence: 81, evidence: [{ evidenceId: 'ownership-1', providerId: 'registry', confidence: 94 }] },
    ])
    expect(graph.edges.map((e) => e.relationshipType)).toEqual(['OFFICER_OF', 'OWNER_OF'])
  })

  it('preserves former and unknown relationship status', () => {
    const graph = buildPrincipalCorporateGraph([
      { principal, corporateEntity: company, relationshipType: 'DIRECTOR_OF', status: 'FORMER', confidence: 80, evidence },
      { principal, corporateEntity: { ...company, id: 'c-2' }, relationshipType: 'AGENT_OF', confidence: 50, evidence },
    ])
    expect(graph.edges[0].status).toBe('FORMER')
    expect(graph.edges[1].status).toBe('UNKNOWN')
  })

  it('supports graph traversal by principal and corporate entity', () => {
    const graph = buildPrincipalCorporateGraph([{ principal, corporateEntity: company, relationshipType: 'OFFICER_OF', confidence: 90, evidence }])
    expect(getPrincipalRelationships(graph, 'p-1')).toHaveLength(1)
    expect(getCorporatePrincipals(graph, 'c-1')).toHaveLength(1)
    expect(getPrincipalRelationships(graph, 'missing')).toHaveLength(0)
  })
})
