import type { SupabaseClient } from '@supabase/supabase-js'
import {
  isSearchCommerceFamily,
  rankSearchCommerceProductCandidates,
  isSearchCommerceProductSniperLearningSnapshot,
  isSearchCommerceProductTruthSnapshot,
  productTruthToProductSniperSignals,
  projectProductSniperResearchWork,
  type SearchCommerceProductSniperCandidateInput,
  type SearchCommerceProductSniperLearningSnapshot,
  type SearchCommerceProductSniperReport,
  type VentureWorkItem,
} from '@jhadina/opportunity-core'
import { VentureRuntimeRepository } from './venture-runtime-repository'

export type SearchCommerceProductSniperRepository = Pick<
  VentureRuntimeRepository,
  'getVentureByOpportunity' | 'listReceipts' | 'recordReceipt' | 'listWorkItems' | 'upsertWorkItems'
>

export async function runSearchCommerceProductSniperRuntime(
  client: SupabaseClient,
  input: {
    ownerUserId: string
    opportunityId: string
    candidates: readonly Omit<
      SearchCommerceProductSniperCandidateInput,
      'ventureId' | 'family' | 'evaluatedAt' | 'learningSnapshot'
    >[]
    evaluatedAt?: string
  },
  repository: SearchCommerceProductSniperRepository = new VentureRuntimeRepository(client),
): Promise<SearchCommerceProductSniperReport> {
  const ownerUserId = requireText(input.ownerUserId, 'owner')
  const opportunityId = requireText(input.opportunityId, 'opportunity')
  const evaluatedAt = normalizeDate(input.evaluatedAt ?? new Date().toISOString())
  const venture = await repository.getVentureByOpportunity(ownerUserId, opportunityId)
  if (!venture) throw new Error('SEARCH_COMMERCE_PRODUCT_SNIPER_VENTURE_NOT_FOUND')
  if (!isSearchCommerceFamily(venture.family)) {
    throw new Error('SEARCH_COMMERCE_PRODUCT_SNIPER_FAMILY_NOT_SUPPORTED')
  }
  if (!input.candidates.length) {
    throw new Error('SEARCH_COMMERCE_PRODUCT_SNIPER_CANDIDATES_REQUIRED')
  }

  const [learningReceipts, productTruthReceipts] = await Promise.all([
    repository.listReceipts(ownerUserId, 'product_sniper_learning'),
    repository.listReceipts(ownerUserId, 'product_truth'),
  ])
  const latestLearningByCandidate = new Map<string, SearchCommerceProductSniperLearningSnapshot>()
  for (const receipt of learningReceipts) {
    if (receipt.ventureId !== venture.id) continue
    const snapshot = receipt.payload.snapshot
    if (!isSearchCommerceProductSniperLearningSnapshot(snapshot)) continue
    const prior = latestLearningByCandidate.get(snapshot.candidateId)
    if (!prior || Date.parse(snapshot.observedThrough) > Date.parse(prior.observedThrough)) {
      latestLearningByCandidate.set(snapshot.candidateId, snapshot)
    }
  }

  const productTruthSignalsByCandidate = new Map<string, ReturnType<typeof productTruthToProductSniperSignals>>()
  for (const receipt of productTruthReceipts) {
    if (receipt.ventureId !== venture.id) continue
    const snapshot = receipt.payload.snapshot
    if (!isSearchCommerceProductTruthSnapshot(snapshot) || !snapshot.candidateId) continue
    const prior = productTruthSignalsByCandidate.get(snapshot.candidateId) ?? []
    productTruthSignalsByCandidate.set(
      snapshot.candidateId,
      Object.freeze([...prior, ...productTruthToProductSniperSignals(snapshot)]),
    )
  }

  const report = rankSearchCommerceProductCandidates({
    ventureId: venture.id,
    family: venture.family,
    evaluatedAt,
    candidates: input.candidates.map((candidate) => ({
      ...candidate,
      ventureId: venture.id,
      family: venture.family,
      signals: [
        ...candidate.signals,
        ...(productTruthSignalsByCandidate.get(candidate.id) ?? []),
      ],
      learningSnapshot: latestLearningByCandidate.get(candidate.id),
      evaluatedAt,
    })),
  })

  const projectedResearchWork = projectProductSniperResearchWork({
    report,
    observedAt: evaluatedAt,
  })
  const existingWork = await repository.listWorkItems(ownerUserId, venture.id)
  const projectedById = new Map(projectedResearchWork.map((item) => [item.id, item]))
  const writes: VentureWorkItem[] = []

  for (const item of existingWork) {
    if (!item.step.startsWith('product_sniper:research:')) continue
    if (projectedById.has(item.id)) continue
    if (!['queued', 'blocked', 'waiting', 'running'].includes(item.status)) continue
    writes.push({
      ...item,
      status: 'superseded',
      updatedAt: evaluatedAt,
    })
  }

  const existingById = new Map(existingWork.map((item) => [item.id, item]))
  for (const projected of projectedResearchWork) {
    const prior = existingById.get(projected.id)
    if (prior && ['completed', 'failed'].includes(prior.status)) continue
    if (prior && prior.status === 'queued' && sameRefs(prior.evidenceRefs, projected.evidenceRefs)) continue
    writes.push({
      ...projected,
      createdAt: prior?.createdAt ?? projected.createdAt,
      evidenceRefs: unique([...(prior?.evidenceRefs ?? []), ...projected.evidenceRefs]),
    })
  }

  if (writes.length) {
    await repository.upsertWorkItems(ownerUserId, writes)
  }

  await repository.recordReceipt({
    id: 'product-sniper:' + venture.id + ':' + stableSuffix(evaluatedAt),
    ownerUserId,
    ventureId: venture.id,
    kind: 'product_sniper',
    evidenceRefs: [...report.evidenceRefs],
    payload: {
      report,
      opportunityId,
      authority: report.authority,
      externalActionAuthorized: false,
      publishingAuthorized: false,
      purchasingAuthorized: false,
      moneyMovementAuthorized: false,
    },
    recordedAt: evaluatedAt,
  })

  return report
}

export function isSearchCommerceProductSniperReport(
  value: unknown,
): value is SearchCommerceProductSniperReport {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return typeof record.ventureId === 'string'
    && typeof record.family === 'string'
    && typeof record.evaluatedAt === 'string'
    && Array.isArray(record.candidates)
    && Array.isArray(record.researchQueue)
    && Array.isArray(record.holdQueue)
    && Array.isArray(record.rejected)
    && Array.isArray(record.evidenceRefs)
    && record.authority === 'PRODUCT_SNIPER_PORTFOLIO_ANALYTICS_ONLY'
    && record.externalActionAuthorized === false
    && record.publishingAuthorized === false
    && record.purchasingAuthorized === false
    && record.moneyMovementAuthorized === false
}

function stableSuffix(value: string): string {
  return value.replace(/[^0-9A-Za-z]/g, '').slice(0, 24)
}

function normalizeDate(value: string): string {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) throw new Error('SEARCH_COMMERCE_PRODUCT_SNIPER_TIME_INVALID')
  return new Date(parsed).toISOString()
}

function requireText(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error('SEARCH_COMMERCE_PRODUCT_SNIPER_' + field.toUpperCase() + '_REQUIRED')
  return normalized
}


function sameRefs(a: readonly string[], b: readonly string[]): boolean {
  const left = unique(a).sort()
  const right = unique(b).sort()
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
