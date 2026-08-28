export type PrincipalType = 'OFFICER' | 'OWNER' | 'REGISTERED_AGENT' | 'DIRECTOR' | 'AUTHORIZED_REPRESENTATIVE'

export interface CorporatePrincipalCandidate {
  id: string
  entityId: string
  name: string
  type: PrincipalType
  jurisdiction?: string
  sourceId: string
  evidenceId: string
  observedAt: string
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface PrincipalDiscoveryProvider {
  readonly sourceId: string
  search(entityId: string, legalName: string, jurisdiction?: string): Promise<CorporatePrincipalCandidate[]>
}

export function deduplicatePrincipalCandidates(candidates: CorporatePrincipalCandidate[]): CorporatePrincipalCandidate[] {
  const seen = new Set<string>()
  const result: CorporatePrincipalCandidate[] = []
  for (const candidate of candidates) {
    const key = `${candidate.entityId}|${candidate.type}|${candidate.name.trim().toLowerCase()}|${candidate.jurisdiction?.trim().toLowerCase() ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(candidate)
  }
  return result
}

/** Public-record discovery boundary. It does not infer private contact data. */
export async function discoverCorporatePrincipals(provider: PrincipalDiscoveryProvider, entityId: string, legalName: string, jurisdiction?: string): Promise<CorporatePrincipalCandidate[]> {
  if (!entityId || !legalName) throw new Error('entityId and legalName are required')
  const candidates = await provider.search(entityId, legalName, jurisdiction)
  return deduplicatePrincipalCandidates(candidates)
}
