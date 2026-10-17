import {
  createCctvCameraCatalogClient,
  createGevSpatialContextReadProvider,
  createPublicSatelliteSpatialProvider,
  createSpatialContextProvider,
  createSpatialRealityAdmissionReadProvider,
  type GevFetchLike,
} from '@jhadina/spatial-intelligence-core'
import type { SpatialContextProvider } from './context-builder'
import { createGevLiveObservationReadProvider, mergeSpatialContextReadPackages } from './gev-live-context-read'
import { createSupabaseSpatialEvidenceStore } from './supabase-spatial-evidence-store'
import { createSupabaseSpatialKnowledgeSink } from './supabase-spatial-knowledge-sink'
import { createSupabaseSpatialRealityStore } from './supabase-spatial-reality-store'
import { spatialProductionTelemetry } from './spatial-production-telemetry'

export type ProductionSpatialContextProviderOptions = {
  /** Kept for existing test/caller compatibility; no bare URL can commission a model-input feed. */
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
  const evidenceStore = createSupabaseSpatialEvidenceStore()
  const knowledgeSink = createSupabaseSpatialKnowledgeSink()
  const realityStore = createSupabaseSpatialRealityStore()
  const cameraCatalog = createCctvCameraCatalogClient()
  const satelliteProvider = createPublicSatelliteSpatialProvider()
  const evidenceRead = createGevSpatialContextReadProvider({
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
  const gateway = createGevLiveObservationReadProvider()
  return createSpatialContextProvider({
    userId,
    read: {
      async read(plan, ownerId) {
        const primary = await read.read(plan, ownerId)
        // Live gateway observations are appended *after* canonical admissions.
        // They cannot be stored as Evidence, promoted to Reality, or gain action
        // authority from this read-only model-input contribution.
        const observations = await gateway.read(plan, ownerId)
        return mergeSpatialContextReadPackages(primary, observations)
      },
    },
  })
}
