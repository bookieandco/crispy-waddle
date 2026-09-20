import {
  GevProviderBridge,
  createGevSpatialContextReadProvider,
  createSpatialContextProvider,
  type GevFetchLike,
} from '@jhadina/spatial-intelligence-core'
import type { SpatialContextProvider } from './context-builder'
import { createSupabaseSpatialEvidenceStore } from './supabase-spatial-evidence-store'

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
  if (!baseUrl) return undefined
  const bridge = new GevProviderBridge({
    baseUrl,
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    ...(options.timeoutMs ? { timeoutMs: options.timeoutMs } : {}),
  })
  const evidenceStore = createSupabaseSpatialEvidenceStore()
  const read = createGevSpatialContextReadProvider({ bridge, ...(options.maxEvidence ? { maxEvidence: options.maxEvidence } : {}), ...(evidenceStore ? { evidenceStore } : {}) })
  return createSpatialContextProvider({ userId, read })
}
