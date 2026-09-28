import type { SocialPlatform } from './types.js'

export type ReferenceRightsState =
  | 'owned'
  | 'licensed'
  | 'public_reference_only'
  | 'unknown'

export type ReferenceCreativeObservation = {
  id: string
  sourceUrl: string
  creator?: string
  format: string
  hookMechanic: string
  promise: string
  storyStructure: readonly string[]
  visualPattern: readonly string[]
  ctaPattern?: string
  rightsState: ReferenceRightsState
  evidenceRefs: readonly string[]
  observedAt: string
}

export type CreativeDistanceMeasurement = {
  verbatimOverlap: number
  distinctivePhraseOverlap: number
  shotSequenceSimilarity: number
  visualIdentitySimilarity: number
  captionSimilarity: number
  evidenceRefs: readonly string[]
}

export type CreativeDistanceThresholds = {
  maxVerbatimOverlap: number
  maxDistinctivePhraseOverlap: number
  maxShotSequenceSimilarity: number
  maxVisualIdentitySimilarity: number
  maxCaptionSimilarity: number
}

export type CreativeDistanceDecision = {
  decision: 'INSPIRED' | 'TOO_CLOSE' | 'BLOCKED_RIGHTS'
  blockers: readonly string[]
  evidenceRefs: readonly string[]
  publicationAuthority: 'NONE'
}

export type SocialPublishCanaryPlan = {
  id: string
  assetId: string
  canaryPlatform: SocialPlatform
  expansionPlatforms: readonly SocialPlatform[]
  createdAt: string
  authority: 'PLANNING_ONLY'
}

export type SocialPlatformReceipt = {
  id: string
  canaryPlanId: string
  assetId: string
  platform: SocialPlatform
  accountId: string
  provider: string
  providerPostId?: string
  finalUrl?: string
  state: 'submitted' | 'published' | 'failed' | 'unknown'
  captionVersion: string
  assetVersion: string
  observedAt: string
  evidenceRefs: readonly string[]
}

export type PublishCanaryAssessment = {
  planId: string
  canExpand: boolean
  blockers: readonly string[]
  verifiedReceiptId?: string
  authorizationEffect: 'NONE'
}

export function validateReferenceCreativeObservation(
  observation: ReferenceCreativeObservation,
): ReferenceCreativeObservation {
  requireText(observation.id, 'reference.id')
  requireText(observation.sourceUrl, 'reference.sourceUrl')
  requireText(observation.format, 'reference.format')
  requireText(observation.hookMechanic, 'reference.hookMechanic')
  requireText(observation.promise, 'reference.promise')
  requireEvidence(observation.evidenceRefs, 'reference creative')
  if (!Number.isFinite(Date.parse(observation.observedAt))) throw new Error('REFERENCE_CREATIVE_DATE_INVALID')
  if (!['owned', 'licensed', 'public_reference_only', 'unknown'].includes(observation.rightsState)) {
    throw new Error('REFERENCE_CREATIVE_RIGHTS_INVALID')
  }

  return Object.freeze({
    ...observation,
    sourceUrl: observation.sourceUrl.trim(),
    creator: observation.creator?.trim() || undefined,
    format: observation.format.trim(),
    hookMechanic: observation.hookMechanic.trim(),
    promise: observation.promise.trim(),
    storyStructure: Object.freeze([...observation.storyStructure]),
    visualPattern: Object.freeze([...observation.visualPattern]),
    ctaPattern: observation.ctaPattern?.trim() || undefined,
    evidenceRefs: Object.freeze(unique(observation.evidenceRefs)),
  })
}

export function assessCreativeDistance(input: {
  reference: ReferenceCreativeObservation
  measurement: CreativeDistanceMeasurement
  thresholds: CreativeDistanceThresholds
}): CreativeDistanceDecision {
  const reference = validateReferenceCreativeObservation(input.reference)
  requireEvidence(input.measurement.evidenceRefs, 'creative distance')
  const metrics: Array<[keyof Omit<CreativeDistanceMeasurement, 'evidenceRefs'>, keyof CreativeDistanceThresholds, string]> = [
    ['verbatimOverlap', 'maxVerbatimOverlap', 'verbatim overlap'],
    ['distinctivePhraseOverlap', 'maxDistinctivePhraseOverlap', 'distinctive phrase overlap'],
    ['shotSequenceSimilarity', 'maxShotSequenceSimilarity', 'shot sequence similarity'],
    ['visualIdentitySimilarity', 'maxVisualIdentitySimilarity', 'visual identity similarity'],
    ['captionSimilarity', 'maxCaptionSimilarity', 'caption similarity'],
  ]

  const blockers: string[] = []
  if (reference.rightsState === 'unknown') {
    blockers.push('Reference rights are unknown.')
  }

  for (const [metricKey, thresholdKey, label] of metrics) {
    const value = input.measurement[metricKey]
    const threshold = input.thresholds[thresholdKey]
    assertRatio(value, metricKey)
    assertRatio(threshold, thresholdKey)
    if (value > threshold) blockers.push(`${label} exceeds configured threshold`)
  }

  const decision: CreativeDistanceDecision['decision'] =
    reference.rightsState === 'unknown'
      ? 'BLOCKED_RIGHTS'
      : blockers.length
        ? 'TOO_CLOSE'
        : 'INSPIRED'

  return Object.freeze({
    decision,
    blockers: Object.freeze(blockers),
    evidenceRefs: Object.freeze(unique([
      ...reference.evidenceRefs,
      ...input.measurement.evidenceRefs,
    ])),
    publicationAuthority: 'NONE',
  })
}

export function createSocialPublishCanaryPlan(input: {
  id: string
  assetId: string
  canaryPlatform: SocialPlatform
  expansionPlatforms: readonly SocialPlatform[]
  createdAt: string
}): SocialPublishCanaryPlan {
  requireText(input.id, 'canary.id')
  requireText(input.assetId, 'canary.assetId')
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error('SOCIAL_CANARY_DATE_INVALID')
  const expansionPlatforms = [...new Set(input.expansionPlatforms)]
    .filter((platform) => platform !== input.canaryPlatform)

  return Object.freeze({
    id: input.id.trim(),
    assetId: input.assetId.trim(),
    canaryPlatform: input.canaryPlatform,
    expansionPlatforms: Object.freeze(expansionPlatforms),
    createdAt: input.createdAt,
    authority: 'PLANNING_ONLY',
  })
}

export function validateSocialPlatformReceipt(
  plan: SocialPublishCanaryPlan,
  receipt: SocialPlatformReceipt,
): SocialPlatformReceipt {
  requireText(receipt.id, 'receipt.id')
  requireText(receipt.canaryPlanId, 'receipt.canaryPlanId')
  requireText(receipt.assetId, 'receipt.assetId')
  requireText(receipt.accountId, 'receipt.accountId')
  requireText(receipt.provider, 'receipt.provider')
  if ((receipt.state === 'submitted' || receipt.state === 'published') && !receipt.providerPostId?.trim()) {
    throw new Error('SOCIAL_RECEIPT_PROVIDER_POST_ID_REQUIRED')
  }
  requireText(receipt.captionVersion, 'receipt.captionVersion')
  requireText(receipt.assetVersion, 'receipt.assetVersion')
  requireEvidence(receipt.evidenceRefs, 'platform receipt')
  if (!Number.isFinite(Date.parse(receipt.observedAt))) throw new Error('SOCIAL_RECEIPT_DATE_INVALID')
  if (receipt.canaryPlanId !== plan.id || receipt.assetId !== plan.assetId) {
    throw new Error('SOCIAL_RECEIPT_PLAN_MISMATCH')
  }
  if (receipt.finalUrl !== undefined && !receipt.finalUrl.trim()) throw new Error('SOCIAL_RECEIPT_URL_INVALID')

  return Object.freeze({
    ...receipt,
    finalUrl: receipt.finalUrl?.trim() || undefined,
    evidenceRefs: Object.freeze(unique(receipt.evidenceRefs)),
  })
}

export function assessPublishCanary(input: {
  plan: SocialPublishCanaryPlan
  receipts: readonly SocialPlatformReceipt[]
}): PublishCanaryAssessment {
  const verified = input.receipts
    .map((receipt) => validateSocialPlatformReceipt(input.plan, receipt))
    .filter((receipt) => receipt.platform === input.plan.canaryPlatform && receipt.state === 'published')

  const blockers: string[] = []
  if (!verified.length) blockers.push('Canary platform does not have a verified published receipt.')
  if (verified.length > 1) blockers.push('Multiple published canary receipts are ambiguous; reconcile before expansion.')

  const receipt = verified.length === 1 ? verified[0] : undefined
  if (receipt && !receipt.finalUrl && !receipt.evidenceRefs.length) {
    blockers.push('Published canary receipt lacks verifiable delivery evidence.')
  }

  return Object.freeze({
    planId: input.plan.id,
    canExpand: blockers.length === 0,
    blockers: Object.freeze(blockers),
    verifiedReceiptId: blockers.length === 0 ? receipt?.id : undefined,
    authorizationEffect: 'NONE',
  })
}

function assertRatio(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${String(field)} must be between 0 and 1`)
}

function requireEvidence(values: readonly string[], field: string): void {
  if (!values.length || values.some((value) => !value.trim())) throw new Error(`${field} requires evidence`)
}

function requireText(value: string, field: string): void {
  if (!value?.trim()) throw new Error(`${field} is required`)
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
