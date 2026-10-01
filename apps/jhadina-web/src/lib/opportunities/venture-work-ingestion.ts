import type { SupabaseClient } from '@supabase/supabase-js'
import type { VentureWorkItem, VentureWorkStatus } from '@jhadina/opportunity-core'
import { VentureRuntimeRepository } from './venture-runtime-repository'

export type VentureWorkReceipt = {
  ownerUserId: string
  ventureId: string
  workItemId: string
  agentId: string
  step: string
  status: VentureWorkStatus
  createdAt: string
  observedAt: string
  spendUsd: number
  evidenceRefs: string[]
  outputRefs?: string[]
}

function requireText(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error(`VENTURE_WORK_${field.toUpperCase()}_REQUIRED`)
  return normalized
}

export type VentureWorkIngestionRepository = Pick<VentureRuntimeRepository, 'getVenture' | 'upsertWorkItems'>

export async function ingestVentureWorkReceipt(
  client: SupabaseClient,
  receipt: VentureWorkReceipt,
  repository: VentureWorkIngestionRepository = new VentureRuntimeRepository(client),
): Promise<VentureWorkItem> {
  const ownerUserId = requireText(receipt.ownerUserId, 'owner')
  const ventureId = requireText(receipt.ventureId, 'venture')
  const venture = await repository.getVenture(ownerUserId, ventureId)
  if (!venture) throw new Error('VENTURE_WORK_VENTURE_NOT_FOUND')

  if (!Number.isFinite(Date.parse(receipt.createdAt)) || !Number.isFinite(Date.parse(receipt.observedAt))) {
    throw new Error('VENTURE_WORK_TIMESTAMP_INVALID')
  }
  if (Date.parse(receipt.observedAt) < Date.parse(receipt.createdAt)) {
    throw new Error('VENTURE_WORK_OBSERVATION_PREDATES_CREATION')
  }
  if (!Number.isFinite(receipt.spendUsd) || receipt.spendUsd < 0) {
    throw new Error('VENTURE_WORK_SPEND_INVALID')
  }
  const evidenceRefs = [...new Set(receipt.evidenceRefs.map((value) => value.trim()).filter(Boolean))]
  const outputRefs = [...new Set((receipt.outputRefs ?? []).map((value) => value.trim()).filter(Boolean))]
  if (!evidenceRefs.length) throw new Error('VENTURE_WORK_EVIDENCE_REQUIRED')
  if (receipt.status === 'completed' && !outputRefs.length) {
    throw new Error('VENTURE_WORK_COMPLETED_OUTPUT_REQUIRED')
  }

  const item: VentureWorkItem = {
    id: requireText(receipt.workItemId, 'id'),
    ventureId,
    agentId: requireText(receipt.agentId, 'agent'),
    step: requireText(receipt.step, 'step'),
    status: receipt.status,
    createdAt: receipt.createdAt,
    updatedAt: receipt.observedAt,
    evidenceRefs,
    outputRefs,
    spendUsd: receipt.spendUsd,
    authorizationEffect: 'NONE',
  }

  await repository.upsertWorkItems(ownerUserId, [item])
  return item
}
