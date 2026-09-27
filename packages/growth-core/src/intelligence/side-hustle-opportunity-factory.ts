import {
  adaptCommercialOpportunity,
  buildSideHustleProfile,
  getSideHustleDefinition,
  opportunityProvider,
  proposeSideHustleExperiment,
  scoreSideHustle,
  type CommercialOpportunityKind,
  type Opportunity,
  type OpportunityClaim,
  type OpportunityVertical,
  type SideHustleAutomationMaturity,
  type SideHustleExperimentProposal,
  type SideHustleFamily,
  type SideHustleScore,
  type SideHustleScoreFactors,
} from '@jhadina/opportunity-core'
import type { GrowthId } from '../domain/types.js'
import type { DistributionOpportunity } from './distribution-opportunity.js'

export type GrowthMonetizationEvidenceState = 'hypothesis' | 'observed' | 'validated'

export type GrowthMonetizationEvidence = {
  id: GrowthId
  name: string
  state: GrowthMonetizationEvidenceState
  evidenceQuality: number
  evidenceRefs: readonly string[]
  reportedRevenue?: {
    min?: number
    max?: number
    currency: string
  }
}

export type GrowthSideHustleFactoryInput = {
  providerId: string
  externalId: string
  sourceUrl: string
  sourceName: string
  sourceType?: OpportunityClaim['sourceType']
  family: SideHustleFamily
  distribution: DistributionOpportunity
  scoreFactors: SideHustleScoreFactors
  monetization?: GrowthMonetizationEvidence
  automationMaturity?: SideHustleAutomationMaturity
  title?: string
  description?: string
  targetCustomer?: string
  offer?: string
  riskFlags?: string[]
  capturedAt?: string
}

export type GrowthSideHustleFactoryResult = {
  opportunity: Opportunity
  experimentProposal: SideHustleExperimentProposal
  sideHustleScore: SideHustleScore
  authority: 'OPPORTUNITY_ONLY'
}

/**
 * Converts a Growth distribution signal into the canonical Opportunity / Side
 * Hustle lifecycle. Growth contributes evidence and commercial context only.
 *
 * This function does not publish, spend, contact a buyer, procure inventory,
 * submit a bid, or otherwise authorize an external effect.
 */
export function buildGrowthSideHustleOpportunity(
  input: GrowthSideHustleFactoryInput,
): GrowthSideHustleFactoryResult {
  requireText(input.externalId, 'externalId')
  requireText(input.sourceUrl, 'sourceUrl')
  requireText(input.sourceName, 'sourceName')
  if (!input.distribution.evidenceSignalIds.length) {
    throw new Error('Growth Side Hustle factory requires distribution evidence')
  }

  const definition = getSideHustleDefinition(input.family)
  if (input.family === 'trading_investing_intelligence' || definition.defaultRole === 'capability') {
    throw new Error('Capability-only Side Hustle families cannot become standalone Growth opportunities')
  }

  const commercialKind = commercialKindForFamily(input.family)
  assertFactoryProvider(input.providerId, commercialKind)

  const monetization = input.monetization
  if (monetization) validateMonetizationEvidence(monetization)

  const capturedAt = input.capturedAt ?? new Date().toISOString()
  if (!Number.isFinite(Date.parse(capturedAt))) throw new Error('capturedAt must be a valid date')

  const profile = buildSideHustleProfile({
    family: input.family,
    automationMaturity: input.automationMaturity ?? 'unvalidated',
  })
  const sideHustleScore = scoreSideHustle(input.scoreFactors)
  const monetizationEvidenceQuality = monetization?.evidenceQuality ?? 0
  const opportunityScore = round(
    input.distribution.score * 0.45 +
    sideHustleScore.overall * 0.45 +
    monetizationEvidenceQuality * 0.10,
  )
  const fitScore = round(
    input.distribution.audienceFit * 0.55 +
    sideHustleScore.overall * 0.45,
  )

  const evidenceRefs = unique([
    ...input.distribution.evidenceSignalIds,
    ...(monetization?.evidenceRefs ?? []),
  ])
  const readiness =
    monetization &&
    monetization.state !== 'hypothesis' &&
    monetization.evidenceQuality >= 50 &&
    opportunityScore >= 60
      ? 'experiment_candidate'
      : 'needs_review'

  const base = adaptCommercialOpportunity({
    providerId: input.providerId,
    externalId: input.externalId,
    kind: commercialKind,
    title: input.title?.trim() || `${definition.label}: ${input.distribution.title}`,
    sourceUrl: input.sourceUrl,
    sourceName: input.sourceName,
    description: input.description?.trim() || input.distribution.rationale,
    estimatedRevenue: monetization?.reportedRevenue
      ? {
          min: monetization.reportedRevenue.min,
          max: monetization.reportedRevenue.max,
          currency: monetization.reportedRevenue.currency,
        }
      : undefined,
    capturedAt,
    confidence: clamp01((input.distribution.score + monetizationEvidenceQuality) / 200),
    sourceType: input.sourceType ?? 'secondary',
    riskFlags: unique([
      ...(input.riskFlags ?? []),
      ...(monetization?.state === 'hypothesis' ? ['monetization_hypothesis'] : []),
      ...(monetization ? [] : ['monetization_evidence_missing']),
    ]),
  })

  const opportunity: Opportunity = {
    ...base,
    fitScore,
    opportunityScore,
    metadata: {
      ...base.metadata,
      sideHustleProfile: profile,
      hubCategory: definition.hubCategory,
      growthDistributionOpportunityId: input.distribution.id,
      growthSurfaceId: input.distribution.surfaceId,
      growthEvidenceSignalIds: [...input.distribution.evidenceSignalIds],
      growthRecommendedAction: input.distribution.recommendedAction,
      growthFactoryReadiness: readiness,
      monetizationEvidence: monetization
        ? {
            id: monetization.id,
            name: monetization.name,
            state: monetization.state,
            evidenceQuality: monetization.evidenceQuality,
            evidenceRefs: [...monetization.evidenceRefs],
            reportedRevenue: monetization.reportedRevenue
              ? { ...monetization.reportedRevenue }
              : undefined,
          }
        : null,
      opportunityAuthority: 'OPPORTUNITY_ONLY',
      requiresUserApproval: true,
    },
  }

  const experimentProposal = proposeSideHustleExperiment({
    opportunity,
    evidenceRefs,
    targetCustomer: input.targetCustomer,
    offer: input.offer ?? monetization?.name,
    currency: monetization?.reportedRevenue?.currency,
    generatedAt: capturedAt,
  })

  return {
    opportunity,
    experimentProposal,
    sideHustleScore,
    authority: 'OPPORTUNITY_ONLY',
  }
}

function commercialKindForFamily(family: SideHustleFamily): CommercialOpportunityKind {
  switch (family) {
    case 'commerce_affiliate':
      return 'affiliate'
    case 'pod_personalized_commerce':
      return 'pod'
    case 'dropshipping_product_commerce':
      return 'dropshipping'
    case 'content_social':
    case 'creative_advertising':
    case 'media_production':
    case 'owned_media':
    case 'creator_monetization':
    case 'pr_authority':
      return 'creator'
    case 'digital_products':
    case 'software_apps':
    case 'communities':
    case 'directories_marketplaces':
      return 'digital_product'
    case 'trading_investing_intelligence':
      throw new Error('Trading / investing intelligence is not a commercial Side Hustle opportunity')
    default:
      return 'service'
  }
}

function assertFactoryProvider(providerId: string, kind: CommercialOpportunityKind): void {
  const provider = opportunityProvider(providerId)
  if (!provider) throw new Error(`Unknown Opportunity provider: ${providerId}`)
  const expectedVertical = providerVerticalForKind(kind)
  if (provider.vertical !== expectedVertical) {
    throw new Error(
      `Opportunity provider ${providerId} is registered for ${provider.vertical}, not ${expectedVertical}`,
    )
  }
  if (provider.readiness === 'disabled') {
    throw new Error(`Opportunity provider is disabled: ${providerId}`)
  }
  if (!provider.capabilities.includes('normalize')) {
    throw new Error(`Opportunity provider cannot normalize Growth evidence: ${providerId}`)
  }
}

function providerVerticalForKind(kind: CommercialOpportunityKind): OpportunityVertical {
  switch (kind) {
    case 'affiliate': return 'affiliate'
    case 'pod': return 'pod'
    case 'dropshipping': return 'dropshipping'
    case 'creator': return 'creator'
    case 'digital_product': return 'digital_product'
    case 'service': return 'services'
  }
}

function validateMonetizationEvidence(evidence: GrowthMonetizationEvidence): void {
  requireText(evidence.id, 'monetization.id')
  requireText(evidence.name, 'monetization.name')
  if (!['hypothesis', 'observed', 'validated'].includes(evidence.state)) {
    throw new Error('monetization.state is invalid')
  }
  if (!Number.isFinite(evidence.evidenceQuality) || evidence.evidenceQuality < 0 || evidence.evidenceQuality > 100) {
    throw new Error('monetization.evidenceQuality must be between 0 and 100')
  }
  if (!evidence.evidenceRefs.length || evidence.evidenceRefs.some((value) => !value.trim())) {
    throw new Error('monetization evidence references are required')
  }
  if (evidence.reportedRevenue) {
    requireText(evidence.reportedRevenue.currency, 'monetization.reportedRevenue.currency')
    assertNonNegativeOptional(evidence.reportedRevenue.min, 'monetization.reportedRevenue.min')
    assertNonNegativeOptional(evidence.reportedRevenue.max, 'monetization.reportedRevenue.max')
    if (
      evidence.reportedRevenue.min !== undefined &&
      evidence.reportedRevenue.max !== undefined &&
      evidence.reportedRevenue.min > evidence.reportedRevenue.max
    ) {
      throw new Error('monetization.reportedRevenue min cannot exceed max')
    }
  }
}

function assertNonNegativeOptional(value: number | undefined, field: string): void {
  if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
    throw new Error(`${field} must be a finite non-negative number`)
  }
}

function requireText(value: string, field: string): void {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`)
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function round(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)) * 100) / 100
}
