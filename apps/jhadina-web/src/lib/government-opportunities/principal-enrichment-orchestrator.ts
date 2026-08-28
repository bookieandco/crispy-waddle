import type { CorporatePrincipalCandidate, PrincipalEnrichmentProvider } from './principal-enrichment-provider'

export interface PrincipalEnrichmentRequest {
  corporateEntityId: string
  legalName: string
  jurisdiction?: string
  providerIds?: string[]
}

export interface PrincipalEnrichmentRun {
  corporateEntityId: string
  candidates: CorporatePrincipalCandidate[]
  providerIds: string[]
  corroboratedCandidateIds: string[]
  completedAt: string
}

export function deduplicatePrincipalCandidates(candidates: CorporatePrincipalCandidate[]): CorporatePrincipalCandidate[] {
  const byKey = new Map<string, CorporatePrincipalCandidate>()
  for (const candidate of candidates) {
    const key = [candidate.corporateEntityId, candidate.name.trim().toLocaleLowerCase(), candidate.role.toLocaleLowerCase()].join('|')
    const existing = byKey.get(key)
    if (!existing || candidate.confidence > existing.confidence) byKey.set(key, candidate)
  }
  return [...byKey.values()]
}

export function corroboratedPrincipalIds(candidates: CorporatePrincipalCandidate[]): string[] {
  const sourcesByCandidate = new Map<string, Set<string>>()
  for (const candidate of candidates) {
    const sources = sourcesByCandidate.get(candidate.id) ?? new Set<string>()
    sources.add(candidate.sourceId)
    sourcesByCandidate.set(candidate.id, sources)
  }
  return [...sourcesByCandidate.entries()].filter(([, sources]) => sources.size >= 2).map(([id]) => id)
}

export async function enrichCorporatePrincipals(
  request: PrincipalEnrichmentRequest,
  providers: PrincipalEnrichmentProvider[],
): Promise<PrincipalEnrichmentRun> {
  if (!request.corporateEntityId || !request.legalName) throw new Error('corporateEntityId and legalName are required')
  const selected = request.providerIds?.length
    ? providers.filter((provider) => request.providerIds!.includes(provider.id))
    : providers
  const results = await Promise.all(selected.map((provider) => provider.enrich({
    corporateEntityId: request.corporateEntityId,
    legalName: request.legalName,
    jurisdiction: request.jurisdiction,
  })))
  const candidates = deduplicatePrincipalCandidates(results.flat())
  return {
    corporateEntityId: request.corporateEntityId,
    candidates,
    providerIds: selected.map((provider) => provider.id),
    corroboratedCandidateIds: corroboratedPrincipalIds(candidates),
    completedAt: new Date().toISOString(),
  }
}
