import {
  GevProviderBridge,
  createGevSourcePolicyRegistry,
  normalizeAisPayload,
  normalizeFirmsPayload,
  normalizeGevCctvSources,
  normalizeOpenSkyPayload,
  type GevFetchLike,
  type SpatialObservation,
  type SpatialUsePurpose,
} from '@jhadina/spatial-intelligence-core'
import type { GatewaySource, GevLiveDomain } from './gev-live-source-gateway'

type CommissionableDomain = Exclude<GevLiveDomain, 'earthquake' | 'satellite'>
type Bridge = Pick<GevProviderBridge, 'cctvSources' | 'cctvHealth' | 'openSky' | 'aisLive' | 'firms'>
export type CommissioningSettings = {
  baseUrl?: string
  approvedHostname?: string
  approvals: Partial<Record<CommissionableDomain, boolean>>
}
export type CommissioningOptions = {
  settings?: CommissioningSettings
  bridge?: Bridge
}

const ids: Record<CommissionableDomain, string> = {
  camera: 'gev-cctv', aircraft: 'gev-opensky', vessel: 'gev-aisstream', fire: 'gev-firms',
}
const MAX_BODY_BYTES = 512_000
const MAX_ROWS = 20
const registry = createGevSourcePolicyRegistry()

/**
 * Explicit operator commissioning, NEVER "all enabled". The exact approved
 * hostname must be separately configured and cannot be a localhost/IP target.
 * Approval records source rights; it does not establish a live source or truth.
 */
export function getGevLiveCommissioningSettings(): CommissioningSettings {
  return {
    baseUrl: process.env.JHADINA_GEV_BASE_URL ?? process.env.GEV_BASE_URL,
    approvedHostname: process.env.JHADINA_GEV_APPROVED_HOSTNAME,
    approvals: {
      camera: process.env.JHADINA_GEV_APPROVE_CAMERA === 'true',
      aircraft: process.env.JHADINA_GEV_APPROVE_AIRCRAFT === 'true',
      vessel: process.env.JHADINA_GEV_APPROVE_VESSEL === 'true',
      fire: process.env.JHADINA_GEV_APPROVE_FIRE === 'true',
    },
  }
}

export function verifiedGevUpstreamOrigin(settings: CommissioningSettings): string | null {
  const expected = settings.approvedHostname?.trim().toLowerCase()
  if (!settings.baseUrl?.trim() || !expected || !/^[a-z0-9.-]+$/.test(expected)) return null
  try {
    const url = new URL(settings.baseUrl)
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      (url.pathname !== '/' && url.pathname !== '') || url.port || url.hostname.toLowerCase() !== expected) return null
    // Allow approved DNS hosts only, never direct loopback, private literals or
    // localhost aliases. DNS resolution/egress must also be guarded by host infra.
    if (!expected.includes('.') || expected === 'localhost' || expected.endsWith('.localhost') ||
      expected.endsWith('.local') || expected.endsWith('.internal') ||
      /^\d+\.\d+\.\d+\.\d+$/.test(expected)) return null
    return url.origin
  } catch {
    return null
  }
}

/** Response size and redirect guard for the legacy upstream bridge's typed API. */
export function createBoundedGevFetch(approvedOrigin: string, underlying: typeof fetch = fetch): GevFetchLike {
  return async (rawUrl, init) => {
    const url = new URL(rawUrl)
    if (url.origin !== approvedOrigin || !url.pathname.startsWith('/api/') ||
      url.username || url.password || url.hash) throw new Error('GEV_LIVE_TARGET_NOT_APPROVED')
    const response = await underlying(url.toString(), {
      method: 'GET',
      signal: init?.signal,
      redirect: 'error',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error('GEV_LIVE_UPSTREAM_UNAVAILABLE')
    const contentType = response.headers.get('content-type') ?? ''
    if (!/(?:application\/json|\+json)/i.test(contentType)) throw new Error('GEV_LIVE_UPSTREAM_CONTENT_TYPE_INVALID')
    const sizeHeader = response.headers.get('content-length')
    if (sizeHeader !== null && Number(sizeHeader) > MAX_BODY_BYTES) throw new Error('GEV_LIVE_BODY_TOO_LARGE')
    if (!response.body) throw new Error('GEV_LIVE_EMPTY_BODY')
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        total += value.byteLength
        if (total > MAX_BODY_BYTES) throw new Error('GEV_LIVE_BODY_TOO_LARGE')
        chunks.push(value)
      }
    } finally {
      // A fully consumed reader is already closed. Cancel only on incomplete
      // reads; no cloning of upstream streams for health/telemetry.
      if (total > MAX_BODY_BYTES) await reader.cancel().catch(() => {})
      reader.releaseLock()
    }
    const bytes = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    const body = new TextDecoder().decode(bytes)
    return {
      ok: true, status: response.status,
      json: async () => JSON.parse(body) as unknown,
      text: async () => body,
    }
  }
}

const unavailable = (domain: CommissionableDomain, reason: string): GatewaySource => {
  const sourceId = ids[domain]
  const policy = registry.require(sourceId)
  return {
    domain, sourceId, attribution: policy.attribution, termsRef: policy.termsRef,
    status: 'UNAVAILABLE', observations: [], observedCount: 0,
    limitations: [reason],
  }
}

export async function readCommissionedGevSource(
  domain: CommissionableDomain,
  purpose: SpatialUsePurpose,
  receivedAt: string,
  options: CommissioningOptions = {},
): Promise<GatewaySource> {
  const sourceId = ids[domain]
  const sourcePolicy = registry.require(sourceId)
  if (!registry.decide(sourceId, purpose).allowed) {
    return {
      ...unavailable(domain, 'Source policy prohibits this purpose.'),
      status: 'DENIED',
    }
  }
  const settings = options.settings ?? getGevLiveCommissioningSettings()
  const origin = verifiedGevUpstreamOrigin(settings)
  if (!origin || settings.approvals[domain] !== true) {
    return unavailable(domain, 'Domain is not approved and configured for a verified HTTPS upstream.')
  }
  try {
    const bridge: Bridge = options.bridge ?? new GevProviderBridge({
      baseUrl: origin, timeoutMs: 5_000, fetchImpl: createBoundedGevFetch(origin),
    })
    let observations: SpatialObservation[]
    if (domain === 'camera') {
      const [sources, health] = await Promise.all([bridge.cctvSources(purpose), bridge.cctvHealth(purpose)])
      observations = normalizeGevCctvSources(sources.slice(0, MAX_ROWS), receivedAt, health)
      // A camera catalog and status map cannot prove a live feed.
      observations = observations.map((row) => ({
        ...row, quality: { ...row.quality, freshness: 'unknown' },
        attributes: { ...row.attributes, realityAdmissionEligible: false },
      }))
    } else if (domain === 'aircraft') {
      const payload = await bridge.openSky({}, purpose)
      if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { states?: unknown }).states)) {
        throw new Error('GEV_LIVE_OPENSKY_ENVELOPE_INVALID')
      }
      observations = normalizeOpenSkyPayload(payload, receivedAt).slice(0, MAX_ROWS)
    } else if (domain === 'vessel') {
      const payload = await bridge.aisLive(MAX_ROWS, purpose)
      if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { rows?: unknown }).rows)) {
        throw new Error('GEV_LIVE_AIS_ENVELOPE_INVALID')
      }
      observations = normalizeAisPayload(payload, receivedAt).slice(0, MAX_ROWS)
    } else {
      const payload = await bridge.firms(purpose)
      if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { fires?: unknown }).fires)) {
        throw new Error('GEV_LIVE_FIRMS_ENVELOPE_INVALID')
      }
      observations = normalizeFirmsPayload(payload, receivedAt).slice(0, MAX_ROWS)
    }
    return {
      domain, sourceId, status: 'AVAILABLE', observations,
      observedCount: observations.length,
      attribution: sourcePolicy.attribution, termsRef: sourcePolicy.termsRef,
      limitations: domain === 'camera'
        ? ['Camera catalog and demand-populated health are not proof of an active media feed; never admit catalog metadata as live reality.']
        : ['Observations need independent freshness, provenance and policy verification before Reality admission.'],
    }
  } catch {
    return unavailable(domain, 'Commissioned upstream failed its transport, schema or policy verification.')
  }
}
