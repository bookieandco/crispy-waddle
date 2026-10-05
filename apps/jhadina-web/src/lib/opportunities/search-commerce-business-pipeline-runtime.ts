import type { SupabaseClient } from '@supabase/supabase-js'
import {
  projectSearchCommerceToBusinessPipeline,
  type SearchCommerceDueTaskQueue,
  type SearchCommerceStorefrontDiagnostic,
} from '@jhadina/opportunity-core'
import { VentureRuntimeRepository } from './venture-runtime-repository'

export type SearchCommerceBusinessPipelineRepository = Pick<
  VentureRuntimeRepository,
  'getVenture' | 'upsertWorkItems'
>

export async function persistSearchCommerceBusinessPipeline(
  client: SupabaseClient,
  input: {
    ownerUserId: string
    ventureId: string
    queue: SearchCommerceDueTaskQueue
    diagnostic?: SearchCommerceStorefrontDiagnostic
    observedAt?: string
    evidenceRefs: string[]
  },
  repository: SearchCommerceBusinessPipelineRepository = new VentureRuntimeRepository(client),
) {
  const ownerUserId = requireText(input.ownerUserId, 'owner')
  const ventureId = requireText(input.ventureId, 'venture')
  const venture = await repository.getVenture(ownerUserId, ventureId)
  if (!venture) throw new Error('SEARCH_COMMERCE_BUSINESS_PIPELINE_VENTURE_NOT_FOUND')
  if (venture.family !== input.queue.family) {
    throw new Error('SEARCH_COMMERCE_BUSINESS_PIPELINE_FAMILY_MISMATCH')
  }
  if (input.diagnostic && input.diagnostic.family !== venture.family) {
    throw new Error('SEARCH_COMMERCE_BUSINESS_PIPELINE_DIAGNOSTIC_FAMILY_MISMATCH')
  }

  const observedAt = input.observedAt ?? new Date().toISOString()
  const evidenceRefs = unique([
    ...input.evidenceRefs,
    ...venture.evidenceRefs,
    ...(input.diagnostic?.evidenceRefs ?? []),
  ])
  if (!evidenceRefs.length) {
    throw new Error('SEARCH_COMMERCE_BUSINESS_PIPELINE_EVIDENCE_REQUIRED')
  }

  const projection = projectSearchCommerceToBusinessPipeline({
    ventureId,
    queue: input.queue,
    observedAt,
    evidenceRefs,
  })

  const persisted = await repository.upsertWorkItems(
    ownerUserId,
    projection.items.map((item) => item.ventureWorkItem),
  )

  return Object.freeze({
    ventureId,
    family: venture.family,
    projection,
    persisted,
    authority: 'SIDE_HUSTLE_BUSINESS_PIPELINE_WORK_ONLY' as const,
    externalActionAuthorized: false as const,
    publishingAuthorized: false as const,
    promotionAuthorized: false as const,
    purchasingAuthorized: false as const,
    moneyMovementAuthorized: false as const,
  })
}

function requireText(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error(`SEARCH_COMMERCE_BUSINESS_PIPELINE_${field.toUpperCase()}_REQUIRED`)
  return normalized
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
