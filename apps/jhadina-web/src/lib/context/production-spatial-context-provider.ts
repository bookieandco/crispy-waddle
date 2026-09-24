import {
  GevProviderBridge,
  createCctvCameraCatalogClient,
  createGevSpatialContextReadProvider,
  createPublicSatelliteSpatialProvider,
  createSpatialContextProvider,
  createSpatialRealityAdmissionReadProvider,
  type GevFetchLike,
} from '@jhadina/spatial-intelligence-core'
import type { SpatialContextProvider } from './context-builder'
import { createSupabaseSpatialEvidenceStore } from './supabase-spatial-evidence-store'
import { createSupabaseSpatialKnowledgeSink } from './supabase-spatial-knowledge-sink'
import { createSupabaseSpatialRealityStore } from './supabase-spatial-reality-store'
import { spatialProductionTelemetry } from './spatial-production-telemetry'

export type ProductionSpatialContextProviderOptions = {
  baseUrl?: string
  fetchImpl?: GevFetchLike
  timeoutMs?: number
  maxEvidence?: number
}

/**
 * Production Ask-Jhadina composition seam. Live GEV is optional at composition
 * time so independent governed sources such as the CCTV specification catalog
 * can still contribute. Missing GEV remains explicit/fail-closed in source health.
 */
export function createProductionSpatialContextProvider(
  userId: string,
  options: ProductionSpatialContextProviderOptions = {},
): SpatialContextProvider | undefined {
  const baseUrl = options.baseUrl ?? process.env.JHADINA_GEV_BASE_URL ?? process.env.GEV_BASE_URL
  const bridge = baseUrl ? new GevProviderBridge({
    baseUrl,
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    ...(options.timeoutMs ? { timeoutMs: options.timeoutMs } : {}),
    telemetry: spatialProductionTelemetry,
  }) : undefined
  const evidenceStore = createSupabaseSpatialEvidenceStore()
  const knowledgeSink = createSupabaseSpatialKnowledgeSink()
  const realityStore = createSupabaseSpatialRealityStore()
  const cameraCatalog = createCctvCameraCatalogClient()
  const satelliteProvider = createPublicSatelliteSpatialProvider()
  const evidenceRead = createGevSpatialContextReadProvider({
    ...(bridge ? { bridge } : {}),
    cameraCatalog,
    satelliteProvider,
    purpose: 'model-input',
    ...(options.maxEvidence ? { maxEvidence: options.maxEvidence } : {}),
    ...(evidenceStore ? { evidenceStore } : {}),
    ...(knowledgeSink ? { knowledgeSink } : {}),
    telemetry: spatialProductionTelemetry,
  })
  const read = evidenceStore && realityStore
    ? createSpatialRealityAdmissionReadProvider({ read: evidenceRead, evidenceStore, realityStore, telemetry: spatialProductionTelemetry })
    : evidenceRead
  return createSpatialContextProvider({ userId, read })
}
