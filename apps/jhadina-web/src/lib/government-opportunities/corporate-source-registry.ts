export type CorporateSourceKind = 'CORPORATE_REGISTRY' | 'SEC' | 'SAM_GOV' | 'USASPENDING' | 'GLEIF' | 'BENEFICIAL_OWNERSHIP' | 'PUBLIC_FILING' | 'COMMERCIAL_PROVIDER'

export interface CorporateSourceDefinition {
  id: string
  name: string
  kind: CorporateSourceKind
  priority: number
  requiresApiKey: boolean
  supports: Array<'ENTITY' | 'OFFICER' | 'OWNERSHIP' | 'RELATIONSHIP' | 'AWARD' | 'FILING' | 'IDENTIFIER'>
}

/** Source catalog. Provider adapters must attach source/evidence provenance before facts enter the corporate graph. */
export const CORPORATE_INTELLIGENCE_SOURCES: CorporateSourceDefinition[] = [
  { id: 'opencorporates', name: 'OpenCorporates', kind: 'CORPORATE_REGISTRY', priority: 10, requiresApiKey: true, supports: ['ENTITY', 'OFFICER', 'OWNERSHIP', 'RELATIONSHIP', 'FILING', 'IDENTIFIER'] },
  { id: 'sec', name: 'U.S. Securities and Exchange Commission', kind: 'SEC', priority: 20, requiresApiKey: false, supports: ['ENTITY', 'OFFICER', 'RELATIONSHIP', 'FILING', 'IDENTIFIER'] },
  { id: 'sam-gov', name: 'SAM.gov Entity Registration', kind: 'SAM_GOV', priority: 20, requiresApiKey: false, supports: ['ENTITY', 'IDENTIFIER'] },
  { id: 'usaspending', name: 'USAspending.gov', kind: 'USASPENDING', priority: 30, requiresApiKey: false, supports: ['ENTITY', 'AWARD', 'IDENTIFIER'] },
  { id: 'gleif', name: 'GLEIF LEI Data', kind: 'GLEIF', priority: 30, requiresApiKey: false, supports: ['ENTITY', 'OWNERSHIP', 'RELATIONSHIP', 'IDENTIFIER'] },
  { id: 'beneficial-ownership', name: 'Beneficial Ownership Register / Public Filing Source', kind: 'BENEFICIAL_OWNERSHIP', priority: 40, requiresApiKey: false, supports: ['OWNERSHIP', 'RELATIONSHIP', 'FILING'] },
]

export function getCorporateSourcesFor(capability: CorporateSourceDefinition['supports'][number]): CorporateSourceDefinition[] {
  return CORPORATE_INTELLIGENCE_SOURCES.filter((source) => source.supports.includes(capability)).sort((a, b) => a.priority - b.priority)
}
