import { createGevSourcePolicyRegistry, type SpatialSourcePolicyRegistry, type SpatialUsePurpose } from './source-policy.js'

export type GevFetchResponse = {
  ok: boolean
  status: number
  json(): Promise<unknown>
  text(): Promise<string>
}

export type GevFetchLike = (url: string, init?: { method?: string; signal?: AbortSignal; headers?: Record<string, string> }) => Promise<GevFetchResponse>

export type GevProviderBridgeOptions = {
  baseUrl: string
  fetchImpl?: GevFetchLike
  timeoutMs?: number
  policyRegistry?: SpatialSourcePolicyRegistry
}

export type GevCctvSource = {
  id: string
  name?: string
  city?: string
  provider?: string
  lat: number
  lon: number
  headingDeg?: number
  pitchDeg?: number
  fovDeg?: number
  feedType?: string
  sourceKind?: string
  license?: string
  credit?: string
}

export type GevCctvStream = {
  id: string
  feedType: string
  mediaUrl: string | null
  frameUrl: string
  provider: string
  sourceKind: string
}

const defaultFetch: GevFetchLike = async (url, init) => {
  const response = await fetch(url, init)
  return response
}

function assertBaseUrl(raw: string): URL {
  const url = new URL(raw)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('GEV_BRIDGE_BASE_URL_PROTOCOL_INVALID')
  url.pathname = url.pathname.replace(/\/$/, '')
  url.search = ''
  url.hash = ''
  return url
}

function assertIdentifier(value: string, label: string): string {
  const normalized = value.trim()
  if (!normalized || !/^[a-zA-Z0-9._:-]+$/.test(normalized)) throw new Error(`GEV_BRIDGE_${label}_INVALID`)
  return normalized
}

function withQuery(path: string, values: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) if (value !== undefined) query.set(key, String(value))
  const encoded = query.toString()
  return encoded ? `${path}?${encoded}` : path
}

/**
 * Same-origin GEV bridge. Callers cannot submit arbitrary upstream URLs; every
 * method below constructs one of the explicitly supported GEV API paths.
 */
export class GevProviderBridge {
  private readonly baseUrl: URL
  private readonly fetchImpl: GevFetchLike
  private readonly timeoutMs: number
  private readonly policyRegistry: SpatialSourcePolicyRegistry

  constructor(options: GevProviderBridgeOptions) {
    this.baseUrl = assertBaseUrl(options.baseUrl)
    this.fetchImpl = options.fetchImpl ?? defaultFetch
    this.timeoutMs = options.timeoutMs ?? 12_000
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0 || this.timeoutMs > 60_000) throw new Error('GEV_BRIDGE_TIMEOUT_INVALID')
    this.policyRegistry = options.policyRegistry ?? createGevSourcePolicyRegistry()
  }

  private assertPurpose(sourceId: string, purpose: SpatialUsePurpose): void {
    const decision = this.policyRegistry.decide(sourceId, purpose)
    if (!decision.allowed) throw new Error(`GEV_SOURCE_USE_NOT_ALLOWED:${sourceId}:${purpose}:${decision.disposition}`)
  }

  private async request(path: string): Promise<GevFetchResponse> {
    if (!path.startsWith('/api/')) throw new Error('GEV_BRIDGE_PATH_NOT_ALLOWLISTED')
    const target = new URL(path, this.baseUrl)
    if (target.origin !== this.baseUrl.origin) throw new Error('GEV_BRIDGE_ORIGIN_MISMATCH')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      return await this.fetchImpl(target.toString(), { method: 'GET', signal: controller.signal, headers: { Accept: 'application/json, text/plain;q=0.9' } })
    } finally {
      clearTimeout(timer)
    }
  }

  private async requestJson<T>(sourceId: string, purpose: SpatialUsePurpose, path: string): Promise<T> {
    this.assertPurpose(sourceId, purpose)
    const response = await this.request(path)
    if (!response.ok) throw new Error(`GEV_BRIDGE_HTTP_${response.status}`)
    return await response.json() as T
  }

  private async requestText(sourceId: string, purpose: SpatialUsePurpose, path: string): Promise<string> {
    this.assertPurpose(sourceId, purpose)
    const response = await this.request(path)
    if (!response.ok) throw new Error(`GEV_BRIDGE_HTTP_${response.status}`)
    return await response.text()
  }

  async cctvSources(purpose: SpatialUsePurpose = 'private-analysis'): Promise<GevCctvSource[]> {
    const payload = await this.requestJson<unknown>('gev-cctv', purpose, '/api/cctv/sources')
    const rows = Array.isArray(payload) ? payload : Array.isArray((payload as { sources?: unknown[] })?.sources) ? (payload as { sources: unknown[] }).sources : []
    return rows.filter((row): row is GevCctvSource => {
      const item = row as Partial<GevCctvSource>
      return typeof item.id === 'string' && Number.isFinite(item.lat) && Number.isFinite(item.lon)
    })
  }

  async cctvHealth(purpose: SpatialUsePurpose = 'private-analysis'): Promise<unknown> {
    return await this.requestJson<unknown>('gev-cctv', purpose, '/api/cctv/health')
  }

  async cctvStream(cameraId: string, purpose: SpatialUsePurpose = 'private-analysis'): Promise<GevCctvStream> {
    const id = assertIdentifier(cameraId, 'CAMERA_ID')
    return await this.requestJson<GevCctvStream>('gev-cctv', purpose, `/api/cctv/stream/${encodeURIComponent(id)}`)
  }

  async openSky(input: { lat?: number; lon?: number } = {}, purpose: SpatialUsePurpose = 'private-analysis'): Promise<unknown> {
    if ((input.lat === undefined) !== (input.lon === undefined)) throw new Error('GEV_BRIDGE_OPENSKY_SCOPE_INCOMPLETE')
    if (input.lat !== undefined && (!Number.isFinite(input.lat) || input.lat < -90 || input.lat > 90 || !Number.isFinite(input.lon) || (input.lon as number) < -180 || (input.lon as number) > 180)) throw new Error('GEV_BRIDGE_OPENSKY_SCOPE_INVALID')
    return await this.requestJson<unknown>('gev-opensky', purpose, withQuery('/api/opensky', { lat: input.lat, lon: input.lon }))
  }

  async aisLive(maxRows = 5_000, purpose: SpatialUsePurpose = 'private-analysis'): Promise<unknown> {
    if (!Number.isInteger(maxRows) || maxRows < 1 || maxRows > 50_000) throw new Error('GEV_BRIDGE_AIS_MAX_ROWS_INVALID')
    return await this.requestJson<unknown>('gev-aisstream', purpose, withQuery('/api/ais-live', { maxRows }))
  }

  async firms(purpose: SpatialUsePurpose = 'private-analysis'): Promise<unknown> {
    return await this.requestJson<unknown>('gev-firms', purpose, '/api/firms')
  }

  async firmsStatus(purpose: SpatialUsePurpose = 'private-analysis'): Promise<unknown> {
    return await this.requestJson<unknown>('gev-firms', purpose, '/api/firms/status')
  }

  async tomTomStatus(purpose: SpatialUsePurpose = 'private-analysis'): Promise<unknown> {
    return await this.requestJson<unknown>('gev-tomtom', purpose, '/api/tomtom/status')
  }

  async celestrak(group: string, purpose: SpatialUsePurpose = 'private-analysis'): Promise<string> {
    const normalized = assertIdentifier(group, 'CELESTRAK_GROUP')
    return await this.requestText('gev-celestrak', purpose, `/api/celestrak/${encodeURIComponent(normalized)}`)
  }
}
