import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildSearchCommerceProductPublicationLineage,
  isSearchCommerceFamily,
  isSearchCommerceProductTruthSnapshot,
  type SearchCommerceProductPublicationLineage,
} from '@jhadina/opportunity-core'
import type { SocialRepository } from '../social/repository'
import { createSocialRepository } from '../social/repository'
import { VentureRuntimeRepository } from './venture-runtime-repository'

export type SearchCommerceProductPublicationVentureRepository = Pick<
  VentureRuntimeRepository,
  'getVentureByOpportunity' | 'listReceipts' | 'recordReceipt'
>

export type SearchCommerceProductPublicationDependencies = {
  ventures: SearchCommerceProductPublicationVentureRepository
  social: Pick<SocialRepository, 'listOutbox'>
}

export async function captureSearchCommerceProductPublicationRuntime(
  client: SupabaseClient,
  input: {
    ownerUserId: string
    opportunityId: string
    candidateId: string
    productRef: string
    outboxId: string
    observedAt?: string
    dependencies?: SearchCommerceProductPublicationDependencies
  },
): Promise<SearchCommerceProductPublicationLineage> {
  const ownerUserId = requireText(input.ownerUserId, 'owner')
  const opportunityId = requireText(input.opportunityId, 'opportunity')
  const candidateId = requireText(input.candidateId, 'candidate')
  const productRef = requireText(input.productRef, 'product')
  const outboxId = requireText(input.outboxId, 'outbox')
  const dependencies = input.dependencies ?? {
    ventures: new VentureRuntimeRepository(client),
    social: createSocialRepository(),
  }

  const venture = await dependencies.ventures.getVentureByOpportunity(ownerUserId, opportunityId)
  if (!venture) throw new Error('SEARCH_COMMERCE_PRODUCT_PUBLICATION_VENTURE_NOT_FOUND')
  if (!isSearchCommerceFamily(venture.family)) {
    throw new Error('SEARCH_COMMERCE_PRODUCT_PUBLICATION_FAMILY_NOT_SUPPORTED')
  }

  const [truthReceipts, outbox] = await Promise.all([
    dependencies.ventures.listReceipts(ownerUserId, 'product_truth'),
    dependencies.social.listOutbox(ownerUserId),
  ])

  const truth = truthReceipts
    .filter((receipt) => receipt.ventureId === venture.id)
    .map((receipt) => receipt.payload.snapshot)
    .filter(isSearchCommerceProductTruthSnapshot)
    .filter((snapshot) => snapshot.candidateId === candidateId && snapshot.productRef === productRef)
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0]

  if (!truth) throw new Error('SEARCH_COMMERCE_PRODUCT_PUBLICATION_PRODUCT_TRUTH_REQUIRED')

  const job = outbox.find((candidate) => candidate.id === outboxId)
  if (!job) throw new Error('SEARCH_COMMERCE_PRODUCT_PUBLICATION_OUTBOX_NOT_FOUND')
  if (job.userId !== ownerUserId) throw new Error('SEARCH_COMMERCE_PRODUCT_PUBLICATION_OWNER_MISMATCH')
  if (job.status !== 'delivered' || !job.providerPostId) {
    throw new Error('SEARCH_COMMERCE_PRODUCT_PUBLICATION_NOT_DELIVERED')
  }

  const observedAt = normalizeDate(input.observedAt ?? job.updatedAt)
  const lineage = buildSearchCommerceProductPublicationLineage({
    id: 'social:' + job.id,
    ventureId: venture.id,
    opportunityId: venture.opportunityId,
    family: venture.family,
    candidateId,
    productRef,
    proposalId: job.proposalId,
    outboxId: job.id,
    platform: job.target.platform,
    provider: job.target.provider,
    accountId: job.target.accountId,
    providerPostId: job.providerPostId,
    observedAt,
    evidenceRefs: [
      'product-truth:' + truth.id,
      'social-outbox:' + job.id,
      'social-provider-post:' + job.providerPostId,
    ],
  })

  await dependencies.ventures.recordReceipt({
    id: 'product-publication-lineage:' + venture.id + ':' + job.id,
    ownerUserId,
    ventureId: venture.id,
    kind: 'product_publication_lineage',
    evidenceRefs: [...lineage.evidenceRefs],
    payload: {
      opportunityId,
      candidateId,
      productRef,
      lineage,
      authority: lineage.authority,
      socialAuthorityRetained: true,
      externalActionAuthorized: false,
      publishingAuthorized: false,
      purchasingAuthorized: false,
      moneyMovementAuthorized: false,
    },
    recordedAt: lineage.observedAt,
  })

  return lineage
}

function normalizeDate(value: string): string {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) throw new Error('SEARCH_COMMERCE_PRODUCT_PUBLICATION_TIME_INVALID')
  return new Date(parsed).toISOString()
}

function requireText(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error('SEARCH_COMMERCE_PRODUCT_PUBLICATION_' + field.toUpperCase() + '_REQUIRED')
  return normalized
}
