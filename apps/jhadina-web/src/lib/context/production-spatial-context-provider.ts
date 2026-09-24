import {
  GevProviderBridge,
  createCctvCameraCatalogClient,
  createGevSpatialContextReadProvider,
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
 * Production Ask-Jhadina composition seam. No configured GEV endpoint means no
 * spatial provider is installed; the command path remains functional and
 * explicitly lacks spatial context rather than silently inventing it.
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
  const evidenceRead = createGevSpatialContextReadProvider({
    bridge,
    cameraCatalog,
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
