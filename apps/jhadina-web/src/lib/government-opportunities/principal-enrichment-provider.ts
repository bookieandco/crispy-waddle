export type PrincipalRole = 'OFFICER' | 'DIRECTOR' | 'OWNER' | 'REGISTERED_AGENT' | 'AUTHORIZED_REPRESENTATIVE'

export interface PrincipalEnrichmentRequest {
  entityId: string
  legalName: string
  jurisdiction?: string
  registrationNumber?: string
}

export interface CorporatePrincipalCandidate {
  id: string
  entityId: string
  name: string
  role: PrincipalRole
  sourceId: string
  evidenceId: string
  observedAt: string
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  sourceRecordId?: string
  sourceUrl?: string
  startDate?: string
  endDate?: string
}

export interface PrincipalEnrichmentProvider {
  readonly providerId: string
  enrich(request: PrincipalEnrichmentRequest): Promise<CorporatePrincipalCandidate[]>
}

export function deduplicatePrincipalCandidates(candidates: CorporatePrincipalCandidate[]): CorporatePrincipalCandidate[] {
  const unique = new Map<string, CorporatePrincipalCandidate>()
  for (const candidate of candidates) {
    const key = `${candidate.entityId}|${candidate.name.trim().toLowerCase()}|${candidate.role}`
    const existing = unique.get(key)
    if (!existing || confidenceRank(candidate.confidence) > confidenceRank(existing.confidence)) unique.set(key, candidate)
  }
  return [...unique.values()]
}

function confidenceRank(value: CorporatePrincipalCandidate['confidence']): number {
  return value === 'HIGH' ? 3 : value === 'MEDIUM' ? 2 : 1
}
