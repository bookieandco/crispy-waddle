export type CommercialEvidenceState =
  | 'source_claim'
  | 'hypothesis'
  | 'observed'
  | 'validated'

export type CommercialCommitmentLevel =
  | 'attention'
  | 'problem_confirmed'
  | 'intent'
  | 'behavioral'
  | 'paid'
  | 'repeat'

export type OfferCanvasClaim<T> = {
  value: T
  state: CommercialEvidenceState
  evidenceRefs: readonly string[]
}

export type OfferCanvas = {
  id: string
  opportunityId: string
  customer: OfferCanvasClaim<string>
  problem: OfferCanvasClaim<string>
  desiredOutcome: OfferCanvasClaim<string>
  offer: OfferCanvasClaim<string>
  deliveryModel: OfferCanvasClaim<string>
  acquisitionChannel: OfferCanvasClaim<string>
  retentionMechanism?: OfferCanvasClaim<string>
  price?: OfferCanvasClaim<{ amount: number; currency: string; cadence?: string }>
  assumptions: readonly string[]
  createdAt: string
  authority: 'ANALYSIS_ONLY'
}

export type ValidationTestStatus = 'planned' | 'running' | 'passed' | 'failed' | 'inconclusive'

export type CommercialValidationTest = {
  id: string
  opportunityId: string
  hypothesis: string
  targetCustomer: string
  offer: string
  channel: string
  ask: string
  expectedCommitment: CommercialCommitmentLevel
  maxSpend: number
  currency: string
  maxHours: number
  minimumObservations: number
  successMetric: string
  successThreshold: number
  evidenceRefs: readonly string[]
  status: ValidationTestStatus
  createdAt: string
  authority: 'ANALYSIS_ONLY'
}

export type MarketLearning = {
  id: string
  opportunityId: string
  validationTestId?: string
  assumption: string
  expected: string
  observed: string
  commitmentLevel: CommercialCommitmentLevel
  paidAmount?: number
  currency?: string
  evidenceRefs: readonly string[]
  observedAt: string
  authority: 'EVIDENCE_ONLY'
}

export type ProofSprint = {
  id: string
  opportunityId: string
  question: string
  primaryUncertainty: string
  validationTestIds: readonly string[]
  maxSpend: number
  currency: string
  maxHours: number
  maxDurationDays: number
  successCommitmentLevel: CommercialCommitmentLevel
  createdAt: string
  authority: 'PLANNING_ONLY'
}


export type RecurringValueDimension =
  | 'continuing_education'
  | 'implementation_support'
  | 'peer_network'
  | 'expert_access'
  | 'opportunity_access'
  | 'product_updates'

export type RecurringValueEvidence = {
  dimension: RecurringValueDimension
  evidenceRefs: readonly string[]
  description: string
}

export type RecurringOfferAssessment = {
  supported: boolean
  dimensions: readonly RecurringValueDimension[]
  blockers: readonly string[]
  evidenceRefs: readonly string[]
  authority: 'ANALYSIS_ONLY'
}

export type ProofSprintAssessment = {
  sprintId: string
  opportunityId: string
  decision: 'proven' | 'disproven' | 'inconclusive'
  strongestCommitment: CommercialCommitmentLevel
  marketLearningIds: readonly string[]
  evidenceRefs: readonly string[]
  reasons: readonly string[]
  assessedAt: string
  authorizationEffect: 'NONE'
}

const COMMITMENT_ORDER: readonly CommercialCommitmentLevel[] = [
  'attention',
  'problem_confirmed',
  'intent',
  'behavioral',
  'paid',
  'repeat',
]

export function createOfferCanvas(input: {
  id: string
  opportunityId: string
  customer: OfferCanvasClaim<string>
  problem: OfferCanvasClaim<string>
  desiredOutcome: OfferCanvasClaim<string>
  offer: OfferCanvasClaim<string>
  deliveryModel: OfferCanvasClaim<string>
  acquisitionChannel: OfferCanvasClaim<string>
  retentionMechanism?: OfferCanvasClaim<string>
  price?: OfferCanvasClaim<{ amount: number; currency: string; cadence?: string }>
  assumptions?: readonly string[]
  createdAt: string
}): OfferCanvas {
  requireText(input.id, 'id')
  requireText(input.opportunityId, 'opportunityId')
  requireDate(input.createdAt, 'createdAt')
  assertTextClaim(input.customer, 'customer')
  assertTextClaim(input.problem, 'problem')
  assertTextClaim(input.desiredOutcome, 'desiredOutcome')
  assertTextClaim(input.offer, 'offer')
  assertTextClaim(input.deliveryModel, 'deliveryModel')
  assertTextClaim(input.acquisitionChannel, 'acquisitionChannel')
  if (input.retentionMechanism) assertTextClaim(input.retentionMechanism, 'retentionMechanism')
  if (input.price) {
    assertClaim(input.price, 'price')
    if (!Number.isFinite(input.price.value.amount) || input.price.value.amount < 0) {
      throw new Error('price.amount must be a finite non-negative number')
    }
    requireText(input.price.value.currency, 'price.currency')
  }

  return Object.freeze({
    id: input.id.trim(),
    opportunityId: input.opportunityId.trim(),
    customer: freezeClaim(input.customer),
    problem: freezeClaim(input.problem),
    desiredOutcome: freezeClaim(input.desiredOutcome),
    offer: freezeClaim(input.offer),
    deliveryModel: freezeClaim(input.deliveryModel),
    acquisitionChannel: freezeClaim(input.acquisitionChannel),
    retentionMechanism: input.retentionMechanism ? freezeClaim(input.retentionMechanism) : undefined,
    price: input.price ? freezeClaim({
      ...input.price,
      value: Object.freeze({ ...input.price.value, currency: input.price.value.currency.trim().toUpperCase() }),
    }) : undefined,
    assumptions: Object.freeze(unique(input.assumptions ?? [])),
    createdAt: input.createdAt,
    authority: 'ANALYSIS_ONLY',
  })
}

export function createCommercialValidationTest(input: Omit<CommercialValidationTest, 'status' | 'authority'>): CommercialValidationTest {
  requireText(input.id, 'id')
  requireText(input.opportunityId, 'opportunityId')
  requireText(input.hypothesis, 'hypothesis')
  requireText(input.targetCustomer, 'targetCustomer')
  requireText(input.offer, 'offer')
  requireText(input.channel, 'channel')
  requireText(input.ask, 'ask')
  requireText(input.successMetric, 'successMetric')
  requireText(input.currency, 'currency')
  requireDate(input.createdAt, 'createdAt')
  requireCommitment(input.expectedCommitment)
  requireNonNegative(input.maxSpend, 'maxSpend')
  requirePositive(input.maxHours, 'maxHours')
  requirePositiveInteger(input.minimumObservations, 'minimumObservations')
  if (!Number.isFinite(input.successThreshold)) throw new Error('successThreshold must be finite')
  requireEvidence(input.evidenceRefs, 'validation test')

  return Object.freeze({
    ...input,
    id: input.id.trim(),
    opportunityId: input.opportunityId.trim(),
    hypothesis: input.hypothesis.trim(),
    targetCustomer: input.targetCustomer.trim(),
    offer: input.offer.trim(),
    channel: input.channel.trim(),
    ask: input.ask.trim(),
    currency: input.currency.trim().toUpperCase(),
    successMetric: input.successMetric.trim(),
    evidenceRefs: Object.freeze(unique(input.evidenceRefs)),
    status: 'planned',
    authority: 'ANALYSIS_ONLY',
  })
}

export function createMarketLearning(input: Omit<MarketLearning, 'authority'>): MarketLearning {
  requireText(input.id, 'id')
  requireText(input.opportunityId, 'opportunityId')
  requireText(input.assumption, 'assumption')
  requireText(input.expected, 'expected')
  requireText(input.observed, 'observed')
  requireDate(input.observedAt, 'observedAt')
  requireCommitment(input.commitmentLevel)
  requireEvidence(input.evidenceRefs, 'market learning')
  if (input.paidAmount !== undefined) {
    requireNonNegative(input.paidAmount, 'paidAmount')
    requireText(input.currency ?? '', 'currency')
  }
  if (commitmentRank(input.commitmentLevel) >= commitmentRank('paid') && input.paidAmount === undefined) {
    throw new Error('paid or repeat commitment requires paidAmount evidence')
  }

  return Object.freeze({
    ...input,
    id: input.id.trim(),
    opportunityId: input.opportunityId.trim(),
    validationTestId: input.validationTestId?.trim() || undefined,
    assumption: input.assumption.trim(),
    expected: input.expected.trim(),
    observed: input.observed.trim(),
    currency: input.currency?.trim().toUpperCase(),
    evidenceRefs: Object.freeze(unique(input.evidenceRefs)),
    authority: 'EVIDENCE_ONLY',
  })
}

export function createProofSprint(input: Omit<ProofSprint, 'authority'>): ProofSprint {
  requireText(input.id, 'id')
  requireText(input.opportunityId, 'opportunityId')
  requireText(input.question, 'question')
  requireText(input.primaryUncertainty, 'primaryUncertainty')
  requireText(input.currency, 'currency')
  requireDate(input.createdAt, 'createdAt')
  requireCommitment(input.successCommitmentLevel)
  requireNonNegative(input.maxSpend, 'maxSpend')
  requirePositive(input.maxHours, 'maxHours')
  requirePositiveInteger(input.maxDurationDays, 'maxDurationDays')
  if (!input.validationTestIds.length || input.validationTestIds.some((id) => !id.trim())) {
    throw new Error('proof sprint requires validationTestIds')
  }

  return Object.freeze({
    ...input,
    id: input.id.trim(),
    opportunityId: input.opportunityId.trim(),
    question: input.question.trim(),
    primaryUncertainty: input.primaryUncertainty.trim(),
    validationTestIds: Object.freeze(unique(input.validationTestIds)),
    currency: input.currency.trim().toUpperCase(),
    authority: 'PLANNING_ONLY',
  })
}

export function assessProofSprint(input: {
  sprint: ProofSprint
  learnings: readonly MarketLearning[]
  assessedAt: string
}): ProofSprintAssessment {
  requireDate(input.assessedAt, 'assessedAt')
  const allowedTests = new Set(input.sprint.validationTestIds)
  const relevant = input.learnings.filter((learning) => {
    if (learning.opportunityId !== input.sprint.opportunityId) {
      throw new Error('market learning belongs to a different opportunity')
    }
    if (Date.parse(learning.observedAt) > Date.parse(input.assessedAt)) {
      throw new Error('proof sprint cannot use future market learning')
    }
    return !learning.validationTestId || allowedTests.has(learning.validationTestId)
  })

  const strongest = relevant.reduce<CommercialCommitmentLevel>(
    (best, learning) => commitmentRank(learning.commitmentLevel) > commitmentRank(best)
      ? learning.commitmentLevel
      : best,
    'attention',
  )
  const targetRank = commitmentRank(input.sprint.successCommitmentLevel)
  const strongestRank = commitmentRank(strongest)
  const observedTestIds = new Set(
    relevant
      .map((learning) => learning.validationTestId)
      .filter((id): id is string => Boolean(id)),
  )
  const allPlannedTestsObserved = input.sprint.validationTestIds.every((id) => observedTestIds.has(id))

  const decision: ProofSprintAssessment['decision'] =
    strongestRank >= targetRank
      ? 'proven'
      : allPlannedTestsObserved
        ? 'disproven'
        : 'inconclusive'

  const reasons = decision === 'proven'
    ? [`Observed commitment ${strongest} meets or exceeds target ${input.sprint.successCommitmentLevel}.`]
    : decision === 'disproven'
      ? [`Observed commitment ${strongest} did not reach target ${input.sprint.successCommitmentLevel} across the planned test set.`]
      : ['Not enough market evidence has been observed to resolve the sprint question.']

  return Object.freeze({
    sprintId: input.sprint.id,
    opportunityId: input.sprint.opportunityId,
    decision,
    strongestCommitment: strongest,
    marketLearningIds: Object.freeze(relevant.map((learning) => learning.id)),
    evidenceRefs: Object.freeze(unique(relevant.flatMap((learning) => learning.evidenceRefs))),
    reasons: Object.freeze(reasons),
    assessedAt: input.assessedAt,
    authorizationEffect: 'NONE',
  })
}


export function assessRecurringOffer(input: {
  continuingValue: readonly RecurringValueEvidence[]
  minimumDistinctDimensions: number
  memberOutcomeEvidenceRefs: readonly string[]
  supportCapacityEvidenceRefs: readonly string[]
}): RecurringOfferAssessment {
  if (!Number.isInteger(input.minimumDistinctDimensions) || input.minimumDistinctDimensions < 1) {
    throw new Error('RECURRING_VALUE_MINIMUM_DIMENSIONS_INVALID')
  }
  const dimensions = unique(input.continuingValue.map((item) => item.dimension)) as RecurringValueDimension[]
  const refs: string[] = []
  const blockers: string[] = []

  for (const item of input.continuingValue) {
    requireText(item.description, 'recurringValue.description')
    requireEvidence(item.evidenceRefs, `recurring value ${item.dimension}`)
    refs.push(...item.evidenceRefs)
  }
  if (dimensions.length < input.minimumDistinctDimensions) {
    blockers.push('Recurring offer does not yet have enough distinct continuing-value dimensions.')
  }
  if (!input.memberOutcomeEvidenceRefs.length) {
    blockers.push('Member/customer outcome evidence is missing.')
  } else {
    refs.push(...input.memberOutcomeEvidenceRefs)
  }
  if (!input.supportCapacityEvidenceRefs.length) {
    blockers.push('Ongoing support capacity evidence is missing.')
  } else {
    refs.push(...input.supportCapacityEvidenceRefs)
  }

  return Object.freeze({
    supported: blockers.length === 0,
    dimensions: Object.freeze(dimensions),
    blockers: Object.freeze(blockers),
    evidenceRefs: Object.freeze(unique(refs)),
    authority: 'ANALYSIS_ONLY',
  })
}

export function commitmentRank(level: CommercialCommitmentLevel): number {
  const index = COMMITMENT_ORDER.indexOf(level)
  if (index < 0) throw new Error('unknown commercial commitment level')
  return index
}

function assertTextClaim(claim: OfferCanvasClaim<string>, field: string): void {
  assertClaim(claim, field)
  requireText(claim.value, `${field}.value`)
}

function assertClaim<T>(claim: OfferCanvasClaim<T>, field: string): void {
  if (!claim || !['source_claim', 'hypothesis', 'observed', 'validated'].includes(claim.state)) {
    throw new Error(`${field}.state is invalid`)
  }
  if (claim.state !== 'hypothesis') requireEvidence(claim.evidenceRefs, field)
}

function freezeClaim<T>(claim: OfferCanvasClaim<T>): OfferCanvasClaim<T> {
  return Object.freeze({ ...claim, evidenceRefs: Object.freeze(unique(claim.evidenceRefs)) })
}

function requireCommitment(value: CommercialCommitmentLevel): void {
  if (!COMMITMENT_ORDER.includes(value)) throw new Error('commercial commitment level is invalid')
}

function requireEvidence(values: readonly string[], field: string): void {
  if (!values.length || values.some((value) => !value.trim())) {
    throw new Error(`${field} requires evidence references`)
  }
}

function requireText(value: string, field: string): void {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`)
}

function requireDate(value: string, field: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`${field} must be a valid date`)
}

function requireNonNegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${field} must be non-negative`)
}

function requirePositive(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${field} must be positive`)
}

function requirePositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${field} must be a positive integer`)
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
