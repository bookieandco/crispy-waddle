import type { SupabaseClient } from '@supabase/supabase-js'
import {
  isSearchCommerceFamily,
  rankSearchCommerceProductCandidates,
  type SearchCommerceProductSniperCandidateInput,
  type SearchCommerceProductSniperReport,
} from '@jhadina/opportunity-core'
import { VentureRuntimeRepository } from './venture-runtime-repository'

export type SearchCommerceProductSniperRepository = Pick<
  VentureRuntimeRepository,
  'getVentureByOpportunity' | 'recordReceipt'
>

export async function runSearchCommerceProductSniperRuntime(
  client: SupabaseClient,
  input: {
    ownerUserId: string
    opportunityId: string
    candidates: readonly Omit<
      SearchCommerceProductSniperCandidateInput,
      'ventureId' | 'family' | 'evaluatedAt'
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

  const report = rankSearchCommerceProductCandidates({
    ventureId: venture.id,
    family: venture.family,
    evaluatedAt,
    candidates: input.candidates.map((candidate) => ({
      ...candidate,
      ventureId: venture.id,
      family: venture.family,
      evaluatedAt,
    })),
  })

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
