import type { CorporatePrincipalCandidate, PrincipalEnrichmentProvider, PrincipalEnrichmentRequest, PrincipalRole } from './principal-enrichment-provider'

interface OpenCorporatesOfficer { id?: number | string; name?: string; position?: string; uid?: string | null; start_date?: string | null; end_date?: string | null; opencorporates_url?: string }
interface OpenCorporatesResponse { results?: { officers?: Array<{ officer?: OpenCorporatesOfficer }> } }

export interface OpenCorporatesPrincipalAdapterOptions { apiToken: string; fetchImpl?: typeof fetch; baseUrl?: string; sourceId?: string }

export class OpenCorporatesPrincipalAdapter implements PrincipalEnrichmentProvider {
  readonly providerId = 'opencorporates'
  private readonly fetchImpl: typeof fetch
  private readonly baseUrl: string
  private readonly sourceId: string
  constructor(private readonly options: OpenCorporatesPrincipalAdapterOptions) {
    if (!options.apiToken.trim()) throw new Error('OpenCorporates API token is required')
    this.fetchImpl = options.fetchImpl ?? fetch
    this.baseUrl = (options.baseUrl ?? 'https://api.opencorporates.com/v0.4').replace(/\/$/, '')
    this.sourceId = options.sourceId ?? 'opencorporates'
  }
  async enrich(request: PrincipalEnrichmentRequest): Promise<CorporatePrincipalCandidate[]> {
    const params = new URLSearchParams({ q: request.legalName, api_token: this.options.apiToken, per_page: '50' })
    if (request.jurisdiction) params.set('jurisdiction_code', request.jurisdiction)
    const response = await this.fetchImpl(`${this.baseUrl}/officers/search?${params.toString()}`, { headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`OpenCorporates officer search failed: HTTP ${response.status}`)
    const payload = (await response.json()) as OpenCorporatesResponse
    const observedAt = new Date().toISOString()
    return (payload.results?.officers ?? []).flatMap(({ officer }) => officer?.name ? [this.normalize(request, officer, observedAt)] : [])
  }
  private normalize(request: PrincipalEnrichmentRequest, officer: OpenCorporatesOfficer, observedAt: string): CorporatePrincipalCandidate {
    const role = normalizeRole(officer.position)
    const sourceRecordId = officer.id == null ? undefined : String(officer.id)
    const id = `${this.providerId}:${request.entityId}:${sourceRecordId ?? normalizeName(officer.name!)}`
    return { id, entityId: request.entityId, name: officer.name!.trim(), role, sourceId: this.sourceId, evidenceId: `${this.sourceId}:officer:${sourceRecordId ?? normalizeName(officer.name!)}`, observedAt, confidence: sourceRecordId ? 'HIGH' : 'MEDIUM', sourceRecordId, sourceUrl: officer.opencorporates_url, startDate: officer.start_date ?? undefined, endDate: officer.end_date ?? undefined }
  }
}
function normalizeRole(position?: string): PrincipalRole { const value = (position ?? '').toLowerCase(); if (value.includes('agent')) return 'REGISTERED_AGENT'; if (value.includes('owner') || value.includes('member')) return 'OWNER'; if (value.includes('director') || value.includes('ceo') || value.includes('secretary')) return 'DIRECTOR'; return 'OFFICER' }
function normalizeName(value: string): string { return value.trim().toLowerCase().replace(/\s+/g, '-') }
