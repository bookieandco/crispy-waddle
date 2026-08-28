export interface CorporateSearchRequest {
  legalName: string
  jurisdiction?: string
  registrationNumber?: string
}

export interface CorporateRecord {
  id: string
  legalName: string
  jurisdiction: string
  registrationNumber?: string
  status?: string
  sourceId: string
  sourceUrl?: string
  retrievedAt: string
}

export interface CorporateSearchResult {
  records: CorporateRecord[]
  provider: string
  queriedAt: string
  rateLimited: boolean
  provenance: { provider: string; queriedAt: string }
}

export interface CorporateIntelligenceConnector {
  readonly provider: string
  search(request: CorporateSearchRequest): Promise<CorporateSearchResult>
}

/** Provider-neutral boundary for corporate registries and OpenCorporates. */
export async function queryCorporateIntelligence(connector: CorporateIntelligenceConnector, request: CorporateSearchRequest): Promise<CorporateSearchResult> {
  if (!request.legalName.trim()) throw new Error('legalName is required')
  const result = await connector.search({
    ...request,
    legalName: request.legalName.trim(),
    jurisdiction: request.jurisdiction?.trim() || undefined,
    registrationNumber: request.registrationNumber?.trim() || undefined,
  })
  return {
    ...result,
    records: result.records.filter((record) => record.id && record.legalName && record.sourceId),
    provenance: { provider: result.provider, queriedAt: result.queriedAt },
  }
}

export function createUnavailableCorporateConnector(provider: string): CorporateIntelligenceConnector {
  return {
    provider,
    async search(): Promise<CorporateSearchResult> {
      const queriedAt = new Date().toISOString()
      return { records: [], provider, queriedAt, rateLimited: false, provenance: { provider, queriedAt } }
    },
  }
}
