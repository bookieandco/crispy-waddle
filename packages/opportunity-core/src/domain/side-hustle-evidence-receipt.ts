import {
  recordSideHustleExperimentObservation,
  type SideHustleExperiment,
  type SideHustleExperimentObservation,
} from './side-hustle-experiment.js'

export type SideHustleEvidenceSourceOwner =
  | 'growth'
  | 'commerce'
  | 'payment'
  | 'fulfillment'
  | 'sam'
  | 'media'
  | 'user'

const SOURCE_OWNERS = new Set<SideHustleEvidenceSourceOwner>([
  'growth',
  'commerce',
  'payment',
  'fulfillment',
  'sam',
  'media',
  'user',
])

export type SideHustleEvidenceReceipt = {
  id: string
  opportunityId: string
  experimentId?: string
  sourceOwner: SideHustleEvidenceSourceOwner
  sourceRecordType: string
  sourceRecordId: string
  observedAt: string
  metrics: Record<string, number>
  spend: number
  hours: number
  evidenceRefs: string[]
  actionRef?: string
  executionRef?: string
  notes?: string
}

export type SideHustleEvidenceReceiptCompilation = {
  receipt: SideHustleEvidenceReceipt
  observation: SideHustleExperimentObservation
  trackedMetrics: string[]
  ignoredMetrics: string[]
}

/**
 * Converts an evidence receipt emitted by an owning subsystem into a
 * canonical Side Hustle experiment observation.
 *
 * This bridge is intentionally semantic-free: it does not infer that
 * revenue means an order, a click means a lead, or a resource unit means
 * an hour. The source owner must explicitly claim the experiment metrics.
 */
export function compileSideHustleObservationFromReceipt(input: {
  experiment: SideHustleExperiment
  receipt: SideHustleEvidenceReceipt
}): SideHustleEvidenceReceiptCompilation {
  const { experiment, receipt } = input
  validateReceipt(receipt)

  if (receipt.opportunityId !== experiment.opportunityId) {
    throw new Error('Evidence receipt opportunity does not match experiment')
  }
  if (receipt.experimentId && receipt.experimentId !== experiment.id) {
    throw new Error('Evidence receipt experiment does not match experiment')
  }

  const trackedMetrics = trackedSideHustleExperimentMetrics(experiment)
  const missingMetrics = trackedMetrics.filter((metric) => !Object.prototype.hasOwnProperty.call(receipt.metrics, metric))
  if (missingMetrics.length > 0) {
    throw new Error(`Evidence receipt is missing tracked metrics: ${missingMetrics.join(', ')}`)
  }

  const ignoredMetrics = Object.keys(receipt.metrics).filter((metric) => !trackedMetrics.includes(metric))
  const observationMetrics = Object.fromEntries(
    trackedMetrics.map((metric) => [metric, receipt.metrics[metric]]),
  )

  const observation = recordSideHustleExperimentObservation({
    experiment,
    observation: {
      id: stableObservationId(receipt),
      experimentId: experiment.id,
      observedAt: receipt.observedAt,
      metrics: observationMetrics,
      spend: receipt.spend,
      hours: receipt.hours,
      evidenceRefs: unique([
        ...receipt.evidenceRefs,
        ...(receipt.actionRef ? [receipt.actionRef] : []),
        ...(receipt.executionRef ? [receipt.executionRef] : []),
        `${receipt.sourceOwner}:${receipt.sourceRecordType}:${receipt.sourceRecordId}`,
      ]),
      notes: receipt.notes?.trim() || `Imported from ${receipt.sourceOwner} ${receipt.sourceRecordType} receipt ${receipt.sourceRecordId}`,
    },
  })

  return {
    receipt: {
      ...receipt,
      metrics: { ...receipt.metrics },
      evidenceRefs: unique(receipt.evidenceRefs),
    },
    observation,
    trackedMetrics,
    ignoredMetrics,
  }
}

export function trackedSideHustleExperimentMetrics(
  experiment: SideHustleExperiment,
): string[] {
  return unique([
    ...experiment.successCriteria.map((criterion) => criterion.metric),
    ...experiment.killCriteria.map((criterion) => criterion.metric),
  ])
}

export function validateSideHustleEvidenceReceipt(
  receipt: SideHustleEvidenceReceipt,
): SideHustleEvidenceReceipt {
  validateReceipt(receipt)
  return {
    ...receipt,
    metrics: { ...receipt.metrics },
    evidenceRefs: unique(receipt.evidenceRefs),
  }
}

function validateReceipt(receipt: SideHustleEvidenceReceipt): void {
  requireText(receipt.id, 'receipt.id')
  requireText(receipt.opportunityId, 'receipt.opportunityId')
  if (receipt.experimentId !== undefined) requireText(receipt.experimentId, 'receipt.experimentId')
  if (!SOURCE_OWNERS.has(receipt.sourceOwner)) throw new Error('receipt.sourceOwner is invalid')
  requireText(receipt.sourceRecordType, 'receipt.sourceRecordType')
  requireText(receipt.sourceRecordId, 'receipt.sourceRecordId')
  requireDate(receipt.observedAt, 'receipt.observedAt')
  requireNonNegative(receipt.spend, 'receipt.spend')
  requireNonNegative(receipt.hours, 'receipt.hours')

  if (!receipt.metrics || typeof receipt.metrics !== 'object' || Array.isArray(receipt.metrics)) {
    throw new Error('receipt.metrics are required')
  }
  const entries = Object.entries(receipt.metrics)
  if (entries.length === 0) throw new Error('receipt.metrics cannot be empty')
  for (const [metric, value] of entries) {
    requireText(metric, 'receipt.metric')
    if (!Number.isFinite(value)) throw new Error(`receipt metric ${metric} must be finite`)
  }

  if (
    !Array.isArray(receipt.evidenceRefs) ||
    receipt.evidenceRefs.length === 0 ||
    receipt.evidenceRefs.some((ref) => typeof ref !== 'string' || !ref.trim())
  ) {
    throw new Error('Evidence receipt requires non-empty evidence references')
  }

  if (receipt.actionRef !== undefined) requireText(receipt.actionRef, 'receipt.actionRef')
  if (receipt.executionRef !== undefined) requireText(receipt.executionRef, 'receipt.executionRef')
}

function stableObservationId(receipt: SideHustleEvidenceReceipt): string {
  return `side-hustle-observation:${receipt.sourceOwner}:${sanitize(receipt.sourceRecordType)}:${sanitize(receipt.sourceRecordId)}`
}

function sanitize(value: string): string {
  return value.trim().replace(/[^0-9A-Za-z._:-]/g, '-').slice(0, 160)
}

function requireText(value: string, field: string): void {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`)
}

function requireDate(value: string, field: string): void {
  if (typeof value !== 'string' || !value.trim() || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${field} must be a valid date`)
  }
}

function requireNonNegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a finite non-negative number`)
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
