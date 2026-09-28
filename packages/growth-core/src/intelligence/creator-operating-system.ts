export type CreatorMaturityStage =
  | 'C0_DISCOVERY'
  | 'C1_CALIBRATE'
  | 'C2_REPEAT'
  | 'C3_SYSTEMIZE'
  | 'C4_AUTOMATE'
  | 'C5_MONETIZE'
  | 'C6_SCALE_DELEGATE'

export type ChannelRole =
  | 'discovery'
  | 'trust'
  | 'depth'
  | 'ownership'
  | 'conversion'
  | 'community'
  | 'retention'

export type WorkEventKind =
  | 'product_build'
  | 'customer_question'
  | 'customer_outcome'
  | 'experiment'
  | 'bug_fix'
  | 'launch'
  | 'research'
  | 'operational_learning'

export type WorkEvent = {
  id: string
  kind: WorkEventKind
  projectId: string
  summary: string
  happenedAt: string
  evidenceRefs: readonly string[]
  publishable: boolean
  containsSensitiveData: boolean
}

export type WorkToContentCandidate = {
  id: string
  sourceEventId: string
  projectId: string
  origin: 'operational_evidence' | 'customer_evidence' | 'research_synthesis'
  angle: string
  evidenceRefs: readonly string[]
  requiresRedaction: boolean
  authority: 'CONTENT_CANDIDATE_ONLY'
}

export type ChannelRoleAssignment = {
  channel: string
  roles: readonly ChannelRole[]
  evidenceRefs: readonly string[]
  lastVerifiedAt: string
}

export type AudienceAsset = {
  id: string
  kind: 'platform_followers' | 'email_subscribers' | 'customer_accounts' | 'community_members' | 'direct_contact_permission'
  count: number
  owned: boolean
  platformDependency: number
  evidenceRefs: readonly string[]
}

export type AudienceOwnershipAssessment = {
  ownedAudience: number
  rentedAudience: number
  ownedShare: number
  concentrationRisk: 'low' | 'medium' | 'high'
  evidenceRefs: readonly string[]
}

export type CreatorAutomationEligibility = {
  eligible: boolean
  maturity: CreatorMaturityStage
  blockers: readonly string[]
  evidenceRefs: readonly string[]
  authorizationEffect: 'NONE'
}

export type FunnelStageMeasurement = {
  stage: 'awareness' | 'interest' | 'owned_audience' | 'activation' | 'purchase' | 'retention'
  actualRate: number
  targetRate: number
  evidenceRefs: readonly string[]
}

export type FunnelBottleneckAssessment = {
  bottleneck: FunnelStageMeasurement['stage']
  gap: number
  evidenceRefs: readonly string[]
  authority: 'ANALYSIS_ONLY'
}

export type ProductRelevanceAssessment = {
  mode: 'no_product' | 'natural_embed' | 'direct_promotion'
  allowed: boolean
  reasons: readonly string[]
  evidenceRefs: readonly string[]
}

const MATURITY_ORDER: readonly CreatorMaturityStage[] = [
  'C0_DISCOVERY',
  'C1_CALIBRATE',
  'C2_REPEAT',
  'C3_SYSTEMIZE',
  'C4_AUTOMATE',
  'C5_MONETIZE',
  'C6_SCALE_DELEGATE',
]

export function buildWorkToContentCandidate(input: {
  event: WorkEvent
  angle: string
}): WorkToContentCandidate {
  assertWorkEvent(input.event)
  requireText(input.angle, 'angle')
  if (!input.event.publishable) throw new Error('WORK_EVENT_NOT_PUBLISHABLE')

  const origin: WorkToContentCandidate['origin'] =
    input.event.kind === 'customer_question' || input.event.kind === 'customer_outcome'
      ? 'customer_evidence'
      : input.event.kind === 'research'
        ? 'research_synthesis'
        : 'operational_evidence'

  return Object.freeze({
    id: `content-candidate:${input.event.id}`,
    sourceEventId: input.event.id,
    projectId: input.event.projectId,
    origin,
    angle: input.angle.trim(),
    evidenceRefs: Object.freeze(unique(input.event.evidenceRefs)),
    requiresRedaction: input.event.containsSensitiveData,
    authority: 'CONTENT_CANDIDATE_ONLY',
  })
}

export function assessCreatorAutomationEligibility(input: {
  maturity: CreatorMaturityStage
  repeatableFormatEvidenceRefs: readonly string[]
  qualityPassRate: number
  minimumQualityPassRate?: number
  channelSignalEvidenceRefs: readonly string[]
  voiceStable: boolean
  formatStable: boolean
}): CreatorAutomationEligibility {
  if (!MATURITY_ORDER.includes(input.maturity)) throw new Error('CREATOR_MATURITY_INVALID')
  if (!Number.isFinite(input.qualityPassRate) || input.qualityPassRate < 0 || input.qualityPassRate > 1) {
    throw new Error('CREATOR_QUALITY_PASS_RATE_INVALID')
  }
  const minimum = input.minimumQualityPassRate ?? 0.8
  if (!Number.isFinite(minimum) || minimum < 0 || minimum > 1) {
    throw new Error('CREATOR_MINIMUM_QUALITY_PASS_RATE_INVALID')
  }

  const blockers: string[] = []
  if (MATURITY_ORDER.indexOf(input.maturity) < MATURITY_ORDER.indexOf('C2_REPEAT')) {
    blockers.push('Creator is still in discovery/calibration; keep the loop human-led.')
  }
  if (!input.repeatableFormatEvidenceRefs.length) blockers.push('Repeatable format evidence is missing.')
  if (!input.channelSignalEvidenceRefs.length) blockers.push('Channel performance signal evidence is missing.')
  if (!input.voiceStable) blockers.push('Creator voice is not yet stable.')
  if (!input.formatStable) blockers.push('Content format is not yet stable.')
  if (input.qualityPassRate < minimum) {
    blockers.push(`Quality pass rate ${input.qualityPassRate} is below required ${minimum}.`)
  }

  return Object.freeze({
    eligible: blockers.length === 0,
    maturity: input.maturity,
    blockers: Object.freeze(blockers),
    evidenceRefs: Object.freeze(unique([
      ...input.repeatableFormatEvidenceRefs,
      ...input.channelSignalEvidenceRefs,
    ])),
    authorizationEffect: 'NONE',
  })
}

export function assessAudienceOwnership(assets: readonly AudienceAsset[]): AudienceOwnershipAssessment {
  if (!assets.length) throw new Error('AUDIENCE_ASSETS_REQUIRED')
  let ownedAudience = 0
  let rentedAudience = 0
  let weightedDependency = 0
  let total = 0
  const refs: string[] = []

  for (const asset of assets) {
    requireText(asset.id, 'audienceAsset.id')
    if (!Number.isFinite(asset.count) || asset.count < 0) throw new Error('AUDIENCE_ASSET_COUNT_INVALID')
    if (!Number.isFinite(asset.platformDependency) || asset.platformDependency < 0 || asset.platformDependency > 1) {
      throw new Error('AUDIENCE_PLATFORM_DEPENDENCY_INVALID')
    }
    requireEvidence(asset.evidenceRefs, 'audience asset')
    if (asset.owned) ownedAudience += asset.count
    else rentedAudience += asset.count
    total += asset.count
    weightedDependency += asset.count * asset.platformDependency
    refs.push(...asset.evidenceRefs)
  }

  const ownedShare = total === 0 ? 0 : ownedAudience / total
  const dependency = total === 0 ? 0 : weightedDependency / total
  const concentrationRisk: AudienceOwnershipAssessment['concentrationRisk'] =
    dependency >= 0.75 ? 'high' : dependency >= 0.4 ? 'medium' : 'low'

  return Object.freeze({
    ownedAudience,
    rentedAudience,
    ownedShare: round(ownedShare),
    concentrationRisk,
    evidenceRefs: Object.freeze(unique(refs)),
  })
}

export function detectFunnelBottleneck(measurements: readonly FunnelStageMeasurement[]): FunnelBottleneckAssessment {
  if (!measurements.length) throw new Error('FUNNEL_MEASUREMENTS_REQUIRED')
  let selected: FunnelStageMeasurement | undefined
  let largestGap = Number.NEGATIVE_INFINITY

  for (const measurement of measurements) {
    assertRate(measurement.actualRate, 'actualRate')
    assertRate(measurement.targetRate, 'targetRate')
    requireEvidence(measurement.evidenceRefs, 'funnel measurement')
    const gap = measurement.targetRate - measurement.actualRate
    if (gap > largestGap) {
      largestGap = gap
      selected = measurement
    }
  }

  if (!selected) throw new Error('FUNNEL_BOTTLENECK_UNRESOLVED')
  return Object.freeze({
    bottleneck: selected.stage,
    gap: round(Math.max(0, largestGap)),
    evidenceRefs: Object.freeze(unique(selected.evidenceRefs)),
    authority: 'ANALYSIS_ONLY',
  })
}

export function assessProductRelevance(input: {
  contentProblem: string
  productCapability?: string
  directPromotion: boolean
  evidenceRefs: readonly string[]
}): ProductRelevanceAssessment {
  requireText(input.contentProblem, 'contentProblem')
  requireEvidence(input.evidenceRefs, 'product relevance')

  if (input.directPromotion) {
    if (!input.productCapability?.trim()) {
      return Object.freeze({
        mode: 'direct_promotion',
        allowed: false,
        reasons: Object.freeze(['Direct promotion requires a concrete product capability.']),
        evidenceRefs: Object.freeze(unique(input.evidenceRefs)),
      })
    }
    return Object.freeze({
      mode: 'direct_promotion',
      allowed: true,
      reasons: Object.freeze(['Content is explicitly promotional and the product capability is stated.']),
      evidenceRefs: Object.freeze(unique(input.evidenceRefs)),
    })
  }

  if (!input.productCapability?.trim()) {
    return Object.freeze({
      mode: 'no_product',
      allowed: true,
      reasons: Object.freeze(['No relevant product capability was supplied; keep the content standalone.']),
      evidenceRefs: Object.freeze(unique(input.evidenceRefs)),
    })
  }

  return Object.freeze({
    mode: 'natural_embed',
    allowed: true,
    reasons: Object.freeze(['A concrete product capability can be demonstrated in the context of the content problem.']),
    evidenceRefs: Object.freeze(unique(input.evidenceRefs)),
  })
}

export function validateChannelRoleAssignment(assignment: ChannelRoleAssignment): ChannelRoleAssignment {
  requireText(assignment.channel, 'channel')
  if (!assignment.roles.length) throw new Error('CHANNEL_ROLES_REQUIRED')
  requireEvidence(assignment.evidenceRefs, 'channel role assignment')
  if (!Number.isFinite(Date.parse(assignment.lastVerifiedAt))) throw new Error('CHANNEL_ROLE_DATE_INVALID')
  return Object.freeze({
    channel: assignment.channel.trim(),
    roles: Object.freeze([...new Set(assignment.roles)]),
    evidenceRefs: Object.freeze(unique(assignment.evidenceRefs)),
    lastVerifiedAt: assignment.lastVerifiedAt,
  })
}

function assertWorkEvent(event: WorkEvent): void {
  requireText(event.id, 'workEvent.id')
  requireText(event.projectId, 'workEvent.projectId')
  requireText(event.summary, 'workEvent.summary')
  if (!Number.isFinite(Date.parse(event.happenedAt))) throw new Error('WORK_EVENT_DATE_INVALID')
  requireEvidence(event.evidenceRefs, 'work event')
}

function assertRate(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${field} must be between 0 and 1`)
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

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000
}
