import type { SpatialObservation } from './observation.js'
import { createGevSourcePolicyRegistry, type SpatialSourcePolicyRegistry, type SpatialUsePurpose } from './source-policy.js'

export type CctvCatalogFetchResponse = {
  ok: boolean
  status: number
  json(): Promise<unknown>
}

export type CctvCatalogFetchLike = (
  url: string,
  init?: { method?: string; signal?: AbortSignal; headers?: Record<string, string> },
) => Promise<CctvCatalogFetchResponse>

export type CctvCameraCatalogProfile = {
  id: string
  brand: string
  model: string
  type: string | null
  resolutionLabel: string | null
  megapixels: number | null
  protocols: string[]
  connectivity: string[]
  powerSource: string[]
  powerMethod: string | null
  ipRating: string | null
  ikRating: string | null
  nightVisionType: string | null
  nightVisionRangeM: number | null
  twoWayAudio: boolean | null
  features: string[]
  sourceUrls: string[]
  lastVerified: string | null
  frigateVerified: boolean | null
}

export type CctvCameraCatalogClientOptions = {
  fetchImpl?: CctvCatalogFetchLike
  timeoutMs?: number
  policyRegistry?: SpatialSourcePolicyRegistry
}

type CatalogBrand = { name: string; slug: string }
type CatalogCameraBrief = { id: string; model: string }

const CATALOG_ORIGIN = 'https://www.cctv-database.com'
const SOURCE_ID = 'cctv-database-catalog'

const defaultFetch: CctvCatalogFetchLike = async (url, init) => await fetch(url, init)

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null

const number = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const boolean = (value: unknown): boolean | null => typeof value === 'boolean' ? value : null

const stringArray = (value: unknown, max = 32): string[] => Array.isArray(value)
  ? [...new Set(value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean))].slice(0, max)
  : []

const normalize = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const safeSlug = (value: string, label: string): string => {
  const normalized = value.trim().toLowerCase()
  if (!normalized || !/^[a-z0-9][a-z0-9-]{0,127}$/.test(normalized)) throw new Error(`CCTV_CATALOG_${label}_INVALID`)
  return normalized
}

const asBrands = (payload: unknown): CatalogBrand[] => {
  const root = record(payload)
  const rows = Array.isArray(payload) ? payload : Array.isArray(root?.brands) ? root?.brands : []
  return rows.flatMap((row) => {
    const item = record(row)
    const name = text(item?.name)
    const slug = text(item?.slug)
    return name && slug ? [{ name, slug }] : []
  })
}

const asCameraBriefs = (payload: unknown): CatalogCameraBrief[] => {
  const root = record(payload)
  const rows = Array.isArray(payload) ? payload : Array.isArray(root?.cameras) ? root?.cameras : []
  return rows.flatMap((row) => {
    const item = record(row)
    const id = text(item?.id)
    const model = text(item?.model)
    return id && model ? [{ id, model }] : []
  })
}

const asProfile = (payload: unknown): CctvCameraCatalogProfile | null => {
  const item = record(payload)
  if (!item) return null
  const id = text(item.id)
  const brand = text(item.brand)
  const model = text(item.model)
  if (!id || !brand || !model) return null

  const resolution = record(item.resolution)
  const nightVision = record(item.night_vision)
  const power = record(item.power)
  const audio = record(item.audio)
  const configs = record(item.configs)
  const frigate = record(configs?.frigate)

  return {
    id,
    brand,
    model,
    type: text(item.type),
    resolutionLabel: text(resolution?.label),
    megapixels: number(resolution?.megapixels),
    protocols: stringArray(item.protocols),
    connectivity: stringArray(item.connectivity),
    powerSource: stringArray(item.power_source),
    powerMethod: text(power?.method),
    ipRating: text(item.ip_rating),
    ikRating: text(item.ik_rating),
    nightVisionType: text(nightVision?.type),
    nightVisionRangeM: number(nightVision?.range_m),
    twoWayAudio: boolean(audio?.two_way),
    features: stringArray(item.features, 40),
    sourceUrls: stringArray(item.sources, 16).filter((url) => /^https?:\/\//i.test(url)),
    lastVerified: text(item.last_verified),
    frigateVerified: boolean(frigate?.verified),
  }
}

export function cctvCatalogProfileToObservation(
  profile: CctvCameraCatalogProfile,
  receivedAt: string,
): SpatialObservation {
  if (Number.isNaN(Date.parse(receivedAt))) throw new Error('CCTV_CATALOG_RECEIVED_AT_INVALID')
  return {
    observation_id: `catalog:cctv-database:${profile.id}:${receivedAt}`,
    entity: { id: `camera-model:${profile.id}`, type: 'camera' },
    observation_type: 'camera_spec_catalog_entry',
    observed_at: null,
    received_at: receivedAt,
    source: { provider: 'CCTV Camera Database', record_id: profile.id },
    position: null,
    attributes: {
      catalogKind: 'camera-specification',
      brand: profile.brand,
      model: profile.model,
      cameraType: profile.type,
      resolutionLabel: profile.resolutionLabel,
      megapixels: profile.megapixels,
      protocols: [...profile.protocols],
      connectivity: [...profile.connectivity],
      powerSource: [...profile.powerSource],
      powerMethod: profile.powerMethod,
      ipRating: profile.ipRating,
      ikRating: profile.ikRating,
      nightVisionType: profile.nightVisionType,
      nightVisionRangeM: profile.nightVisionRangeM,
      twoWayAudio: profile.twoWayAudio,
      features: [...profile.features],
      sourceUrls: [...profile.sourceUrls],
      lastVerified: profile.lastVerified,
      frigateVerified: profile.frigateVerified,
      liveDeploymentEvidence: false,
      liveFeedEvidence: false,
    },
    quality: { freshness: 'unknown', completeness: 'partial', coverage: 'known' },
    provenance: { source_ref: SOURCE_ID, adapter_version: 'cctv-camera-catalog:v1' },
    inference: false,
  }
}

/**
 * Fixed-origin, read-only client for CCTV Camera Database.
 *
 * This source is a camera specification catalog. It never discovers live
 * cameras, resolves private device addresses, or authorizes stream access.
 */
export class CctvCameraCatalogClient {
  private readonly fetchImpl: CctvCatalogFetchLike
  private readonly timeoutMs: number
  private readonly registry: SpatialSourcePolicyRegistry

  constructor(options: CctvCameraCatalogClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? defaultFetch
    this.timeoutMs = options.timeoutMs ?? 8_000
    this.registry = options.policyRegistry ?? createGevSourcePolicyRegistry()
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0 || this.timeoutMs > 30_000) {
      throw new Error('CCTV_CATALOG_TIMEOUT_INVALID')
    }
  }

  private async requestJson(path: string, purpose: SpatialUsePurpose): Promise<unknown> {
    const decision = this.registry.decide(SOURCE_ID, purpose)
    if (!decision.allowed) {
      throw new Error(`CCTV_CATALOG_SOURCE_USE_NOT_ALLOWED:${purpose}:${decision.disposition}`)
    }
    if (!path.startsWith('/api/')) throw new Error('CCTV_CATALOG_PATH_NOT_ALLOWLISTED')
    const target = new URL(path, CATALOG_ORIGIN)
    if (target.origin !== CATALOG_ORIGIN) throw new Error('CCTV_CATALOG_ORIGIN_MISMATCH')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await this.fetchImpl(target.toString(), {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) throw new Error(`CCTV_CATALOG_HTTP_${response.status}`)
      return await response.json()
    } finally {
      clearTimeout(timer)
    }
  }

  async cameraById(cameraId: string, purpose: SpatialUsePurpose = 'private-analysis'): Promise<CctvCameraCatalogProfile> {
    const id = safeSlug(cameraId, 'CAMERA_ID')
    const profile = asProfile(await this.requestJson(`/api/cameras/${encodeURIComponent(id)}.json`, purpose))
    if (!profile) throw new Error('CCTV_CATALOG_CAMERA_RECORD_INVALID')
    return profile
  }

  async searchCameraProfiles(
    query: string,
    purpose: SpatialUsePurpose = 'private-analysis',
    limit = 3,
  ): Promise<CctvCameraCatalogProfile[]> {
    if (!query.trim()) return []
    if (!Number.isInteger(limit) || limit < 1 || limit > 5) throw new Error('CCTV_CATALOG_SEARCH_LIMIT_INVALID')

    const normalizedQuery = normalize(query)
    const brands = asBrands(await this.requestJson('/api/brands.json', purpose))
      .filter((brand) => normalizedQuery.includes(normalize(brand.name)))
      .sort((a, b) => normalize(b.name).length - normalize(a.name).length)

    const brand = brands[0]
    if (!brand) return []

    const slug = safeSlug(brand.slug, 'BRAND_SLUG')
    const cameras = asCameraBriefs(await this.requestJson(`/api/brands/${encodeURIComponent(slug)}.json`, purpose))
      .filter((camera) => {
        const model = normalize(camera.model)
        return Boolean(model) && normalizedQuery.includes(model)
      })
      .slice(0, limit)

    const results: CctvCameraCatalogProfile[] = []
    for (const camera of cameras) {
      try {
        results.push(await this.cameraById(camera.id, purpose))
      } catch {
        // Individual malformed/stale records fail closed without poisoning
        // the other exact catalog matches.
      }
    }
    return results
  }

  async searchObservations(
    query: string,
    purpose: SpatialUsePurpose,
    receivedAt: string,
    limit = 3,
  ): Promise<SpatialObservation[]> {
    const profiles = await this.searchCameraProfiles(query, purpose, limit)
    return profiles.map((profile) => cctvCatalogProfileToObservation(profile, receivedAt))
  }
}

export const createCctvCameraCatalogClient = (
  options: CctvCameraCatalogClientOptions = {},
): CctvCameraCatalogClient => new CctvCameraCatalogClient(options)
