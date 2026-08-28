export type CorporateSource = 'OPENCORPORATES' | 'STATE_REGISTRY' | 'PROCUREMENT' | 'LICENSE_REGISTRY' | 'OPEN_DATA' | 'OTHER_PUBLIC'

export type CorporateEntity = {
  id: string
  legalName: string
  jurisdiction?: string
  entityNumber?: string
  status?: string
  formedAt?: string
  source: CorporateSource
  sourceReference: string
  evidenceIds: string[]
}

export type CorporateRelationship = {
  fromEntityId: string
  toEntityId: string
  type: 'OWNER' | 'OFFICER' | 'CONTROL_PERSON' | 'PARENT' | 'SUBSIDIARY' | 'REGISTERED_IN'
  confidence: number
  source: CorporateSource
  sourceReference: string
  evidenceIds: string[]
}

export type CorporateIntelligenceProvider = {
  name: string
  supportedSources: CorporateSource[]
  searchCompanies(query: string, jurisdiction?: string): Promise<CorporateEntity[]>
  getCompany(entityId: string): Promise<CorporateEntity | null>
  getRelationships(entityId: string): Promise<CorporateRelationship[]>
}

export type EntityMatchCandidate = {
  entityId: string
  score: number
  reasons: string[]
  evidenceIds: string[]
}

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
const clamp = (value: number) => Math.max(0, Math.min(1, value))

/** Deterministic first-pass entity resolution. Never treats a name match alone as proof of identity. */
export function matchCorporateEntities(input: { name: string; jurisdiction?: string; entityNumber?: string }, candidates: CorporateEntity[]): EntityMatchCandidate[] {
  const targetName = normalize(input.name)
  return candidates.map((candidate) => {
    let score = 0
    const reasons: string[] = []
    if (normalize(candidate.legalName) === targetName) { score += 0.55; reasons.push('normalized legal-name match') }
    if (input.entityNumber && candidate.entityNumber === input.entityNumber) { score += 0.3; reasons.push('entity-number match') }
    if (input.jurisdiction && candidate.jurisdiction === input.jurisdiction) { score += 0.15; reasons.push('jurisdiction match') }
    return { entityId: candidate.id, score: clamp(score), reasons, evidenceIds: candidate.evidenceIds }
  }).filter((candidate) => candidate.score > 0).sort((a, b) => b.score - a.score)
}

export type CorporateIntelligenceRegistry = {
  providers: CorporateIntelligenceProvider[]
}

/** Routes lookups across available providers; providers can be added without changing consumers. */
export async function searchCorporateIntelligence(registry: CorporateIntelligenceRegistry, query: string, jurisdiction?: string): Promise<CorporateEntity[]> {
  const results = await Promise.all(registry.providers.map((provider) => provider.searchCompanies(query, jurisdiction)))
  const byId = new Map<string, CorporateEntity>()
  for (const entity of results.flat()) byId.set(entity.id, entity)
  return [...byId.values()]
}
