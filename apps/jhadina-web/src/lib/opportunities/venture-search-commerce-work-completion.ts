import type { SupabaseClient } from '@supabase/supabase-js'
import {
  productSniperCandidateIdFromWorkStep,
  routineIdFromWorkStep,
  type VentureWorkItem,
} from '@jhadina/opportunity-core'
import {
  ingestVentureWorkReceipt,
  type VentureWorkIngestionRepository,
} from './venture-work-ingestion'
import { VentureRuntimeRepository } from './venture-runtime-repository'

export type SearchCommerceWorkCompletionRepository =
  VentureWorkIngestionRepository
  & Pick<VentureRuntimeRepository, 'listWorkItems'>

export async function completeSearchCommerceBusinessWork(
  client: SupabaseClient,
  input: {
    ownerUserId: string
    ventureId: string
    workItemId: string
    completedAt: string
    evidenceRefs: string[]
    outputRefs: string[]
  },
  repository: SearchCommerceWorkCompletionRepository = new VentureRuntimeRepository(client),
): Promise<VentureWorkItem> {
  const ownerUserId = requireText(input.ownerUserId, 'owner')
  const ventureId = requireText(input.ventureId, 'venture')
  const workItemId = requireText(input.workItemId, 'work_item')
  const completedAt = normalizeDate(input.completedAt)

  const workItems = await repository.listWorkItems(ownerUserId, ventureId)
  const existing = workItems.find((item) => item.id === workItemId)
  if (!existing) throw new Error('SEARCH_COMMERCE_WORK_ITEM_NOT_FOUND')
  const routineId = routineIdFromWorkStep(existing.step)
  const productCandidateId = productSniperCandidateIdFromWorkStep(existing.step)
  if (!routineId && !productCandidateId) {
    throw new Error('SEARCH_COMMERCE_WORK_ITEM_KIND_MISMATCH')
  }
  if (existing.status === 'superseded') {
    throw new Error('SEARCH_COMMERCE_WORK_ITEM_SUPERSEDED')
  }
  if (existing.status === 'failed') {
    throw new Error('SEARCH_COMMERCE_WORK_ITEM_FAILED')
  }
  if (existing.status === 'completed') {
    const requestedOutputs = unique(input.outputRefs)
    const existingOutputs = unique(existing.outputRefs)
    if (requestedOutputs.every((ref) => existingOutputs.includes(ref))) return existing
    throw new Error('SEARCH_COMMERCE_WORK_ITEM_ALREADY_COMPLETED')
  }

  return ingestVentureWorkReceipt(
    client,
    {
      ownerUserId,
      ventureId,
      workItemId,
      agentId: existing.agentId,
      step: existing.step,
      status: 'completed',
      createdAt: existing.createdAt,
      observedAt: completedAt,
      spendUsd: existing.spendUsd,
      evidenceRefs: unique([...existing.evidenceRefs, ...input.evidenceRefs]),
      outputRefs: unique(input.outputRefs),
    },
    repository,
  )
}

function requireText(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error('SEARCH_COMMERCE_WORK_' + field.toUpperCase() + '_REQUIRED')
  return normalized
}

function normalizeDate(value: string): string {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) throw new Error('SEARCH_COMMERCE_WORK_COMPLETED_AT_INVALID')
  return new Date(parsed).toISOString()
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
