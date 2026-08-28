import type {
  CorporateEntity,
  CorporateIntelligenceProvider,
  CorporateRelationship,
} from './corporate-intelligence'
import type { EvidenceRecord } from './evidence-provenance'

type CacheEntry<T> = { value: T; expiresAt: number }

type OpenCorporatesCompany = {
  company_number?: string
  jurisdiction_code?: string
  name?: string
  current_status?: string
  incorporation_date?: string | null
  opencorporates_url?: string
  registry_url?: string
}

type OpenCorporatesSearchResponse = {
  results?: { companies?: Array<{ company?: OpenCorporatesCompany }> }
}

type ConnectorOptions = {
  apiToken?: string
  baseUrl?: string
  version?: string
  cacheTtlMs?: number
  maxRequestsPerWindow?: number
  windowMs?: number
  fetchImpl?: typeof fetch
  now?: () => number
}

/**
 * OpenCorporates adapter. Tokens stay server-side; callers provide persistence
 * and may replace the in-memory cache with a durable cache later.
 */
export class OpenCorporatesConnector implements CorporateIntelligenceProvider {
  readonly name = 'OpenCorporates'
  readonly supportedSources = ['OPENCORPORATES'] as const

  private readonly apiToken: string
  private readonly baseUrl: string
  private readonly version: string
  private readonly cacheTtlMs: number
  private readonly maxRequestsPerWindow: number
  private readonly windowMs: number
  private readonly fetchImpl: typeof fetch
  private readonly now: () => number
  private readonly cache = new Map<string, CacheEntry<unknown>>()
  private requestTimestamps: number[] = []

  constructor(options: ConnectorOptions = {}) {
    this.apiToken = options.apiToken ?? process.env.OPENCORPORATES_API_TOKEN ?? ''
    this.baseUrl = (options.baseUrl ?? 'https://api.opencorporates.com').replace(/\/$/, '')
    this.version = options.version ?? 'v0.4'
    this.cacheTtlMs = options.cacheTtlMs ?? 24 * 60 * 60 * 1000
    this.maxRequestsPerWindow = options.maxRequestsPerWindow ?? 50
    this.windowMs = options.windowMs ?? 24 * 60 * 60 * 1000
    this.fetchImpl = options.fetchImpl ?? fetch
    this.now = options.now ?? Date.now
  }

  async searchCompanies(query: string, jurisdiction?: string): Promise<CorporateEntity[]> {
    const params = new URLSearchParams({ q: query, per_page: '50', order: 'score' })
    if (jurisdiction) params.set('jurisdiction_code', jurisdiction)
    const payload = await this.request<OpenCorporatesSearchResponse>(`/${this.version}/companies/search?${params}`)
    const companies = payload.results?.companies ?? []
    return companies.flatMap(({ company }) => company ? [this.toEntity(company)] : [])
  }

  async getCompany(entityId: string): Promise<CorporateEntity | null> {
    const parsed = this.parseEntityId(entityId)
    if (!parsed) return null
    const payload = await this.request<{ results?: { company?: OpenCorporatesCompany } }>(`/${this.version}/companies/${encodeURIComponent(parsed.jurisdiction)}/${encodeURIComponent(parsed.number)}?sparse=true`)
    return payload.results?.company ? this.toEntity(payload.results.company) : null
  }

  async getRelationships(entityId: string): Promise<CorporateRelationship[]> {
    const company = await this.getCompany(entityId)
    if (!company) return []

    const relationships: CorporateRelationship[] = []
    const record = company as CorporateEntity & { controllingEntity?: { id?: string } }
    if (record.controllingEntity?.id) {
      relationships.push({
        fromEntityId: company.id,
        toEntityId: record.controllingEntity.id,
        type: 'PARENT',
        confidence: 80,
        source: 'OPENCORPORATES',
        sourceReference: company.sourceReference,
        evidenceIds: company.evidenceIds,
      })
    }
    return relationships
  }

  getEvidence(entity: CorporateEntity): EvidenceRecord {
    return {
      id: `opencorporates:${entity.id}`,
      kind: 'ENTITY_RECORD',
      url: entity.sourceReference,
      title: entity.legalName,
      publisher: 'OpenCorporates',
      observedAt: new Date(this.now()).toISOString(),
      sourceId: 'opencorporates',
      entityId: entity.id,
    }
  }

  private async request<T>(path: string): Promise<T> {
    if (!this.apiToken) throw new Error('OPENCORPORATES_API_TOKEN is not configured')

    const cacheKey = path
    const cached = this.cache.get(cacheKey) as CacheEntry<T> | undefined
    if (cached && cached.expiresAt > this.now()) return cached.value
    if (cached) this.cache.delete(cacheKey)

    this.enforceRateLimit()
    const url = `${this.baseUrl}${path}${path.includes('?') ? '&' : '?'}api_token=${encodeURIComponent(this.apiToken)}`
    const response = await this.fetchImpl(url, { headers: { accept: 'application/json' } })

    if (response.status === 403) throw new Error('OpenCorporates rate limit or access restriction')
    if (!response.ok) throw new Error(`OpenCorporates request failed: ${response.status}`)

    const value = await response.json() as T
    this.cache.set(cacheKey, { value, expiresAt: this.now() + this.cacheTtlMs })
    return value
  }

  private enforceRateLimit(): void {
    const cutoff = this.now() - this.windowMs
    this.requestTimestamps = this.requestTimestamps.filter((timestamp) => timestamp > cutoff)
    if (this.requestTimestamps.length >= this.maxRequestsPerWindow) {
      throw new Error('OpenCorporates local rate-limit budget exhausted')
    }
    this.requestTimestamps.push(this.now())
  }

  private toEntity(company: OpenCorporatesCompany): CorporateEntity {
    if (!company.name || !company.company_number || !company.jurisdiction_code) {
      throw new Error('OpenCorporates returned an incomplete company record')
    }
    const id = `opencorporates:${company.jurisdiction_code}:${company.company_number}`
    return {
      id,
      legalName: company.name,
      jurisdiction: company.jurisdiction_code,
      entityNumber: company.company_number,
      status: company.current_status,
      formedAt: company.incorporation_date ?? undefined,
      source: 'OPENCORPORATES',
      sourceReference: company.opencorporates_url ?? company.registry_url ?? `${this.baseUrl}/companies/${company.jurisdiction_code}/${company.company_number}`,
      evidenceIds: [`opencorporates:${id}`],
    }
  }

  private parseEntityId(entityId: string): { jurisdiction: string; number: string } | null {
    const match = /^opencorporates:([^:]+):(.+)$/.exec(entityId)
    return match ? { jurisdiction: match[1], number: match[2] } : null
  }
}
