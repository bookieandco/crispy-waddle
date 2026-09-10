import type { EvidenceRef } from './financial-intelligence-contracts.js'
import type { FinancialFact, FundamentalState } from './issuer-reality-contracts.js'

/** MONEY-036 — derived accounting normalization; never issuer-reported reality. */
export type AccountingValue = Readonly<{ coefficient: bigint; scale: number; currency: string; unit: string }>
export type AccountingTreatment = 'REPORTED' | 'NORMALIZED' | 'ADJUSTED' | 'DERIVED'
export type PeriodKind = 'INSTANT' | 'DURATION'
export type NormalizationStatus = 'VALID' | 'PARTIAL' | 'INSUFFICIENT_DATA' | 'CONFLICTING' | 'UNSUPPORTED'

export type AccountingConcept = Readonly<{
  conceptId: string
  canonicalName: string
  statement: 'BALANCE_SHEET' | 'INCOME_STATEMENT' | 'CASH_FLOW' | 'EQUITY' | 'OTHER'
  periodKind: PeriodKind
  evidenceRefs: readonly EvidenceRef[]
  provenanceHash: string
}>

export type NormalizationRule = Readonly<{
  ruleId: string
  version: string
  description: string
  treatment: AccountingTreatment
  evidenceRefs: readonly EvidenceRef[]
  provenanceHash: string
}>

export type NormalizedMetric = Readonly<{
  metricId: string
  issuerId: string
  conceptId: string
  value: AccountingValue
  treatment: AccountingTreatment
  sourceFactIds: readonly string[]
  sourceStateId: string
  informationCutoff: string
  methodologyVersion: string
  normalizationRuleIds: readonly string[]
  status: NormalizationStatus
  inputSnapshotHash: string
  evidenceRefs: readonly EvidenceRef[]
  provenanceHash: string
}>

export type TtmMetric = Readonly<{
  metricId: string
  issuerId: string
  conceptId: string
  value: AccountingValue
  contributingFactIds: readonly string[]
  informationCutoff: string
  methodologyVersion: string
  status: NormalizationStatus
  evidenceRefs: readonly EvidenceRef[]
  provenanceHash: string
}>

export function assertAccountingValue(value: AccountingValue): void {
  if (!Number.isInteger(value.scale) || value.scale < 0) throw new Error('scale must be a non-negative integer')
  if (!value.currency.trim()) throw new Error('currency is required')
  if (!value.unit.trim()) throw new Error('unit is required')
}

export function assertNormalizedMetric(metric: NormalizedMetric): void {
  if (!metric.metricId.trim() || !metric.issuerId.trim() || !metric.conceptId.trim()) throw new Error('metric identity is required')
  if (!metric.sourceStateId.trim() || !metric.inputSnapshotHash.trim() || !metric.provenanceHash.trim()) throw new Error('normalization provenance is required')
  if (!metric.methodologyVersion.trim()) throw new Error('methodologyVersion is required')
  if (metric.sourceFactIds.length === 0) throw new Error('sourceFactIds cannot be empty')
  assertAccountingValue(metric.value)
  if (metric.treatment === 'REPORTED') throw new Error('NormalizedMetric cannot be marked REPORTED')
}

export function normalizeReportedFact(fact: FinancialFact, state: FundamentalState, conceptId: string, value: AccountingValue, methodologyVersion: string, ruleIds: readonly string[], inputSnapshotHash: string, evidenceRefs: readonly EvidenceRef[], provenanceHash: string): NormalizedMetric {
  if (fact.issuerId !== state.issuerId) throw new Error('fact and state issuerId must match')
  if (!state.factIds.includes(fact.factId)) throw new Error('fact is not present in FundamentalState')
  if (state.informationCutoff !== fact.availableAt && Date.parse(fact.availableAt) > Date.parse(state.informationCutoff)) throw new Error('fact is outside information cutoff')
  const metric: NormalizedMetric = Object.freeze({ metricId: `${state.stateId}:${conceptId}:${fact.factId}`, issuerId: state.issuerId, conceptId, value, treatment: 'NORMALIZED', sourceFactIds: Object.freeze([fact.factId]), sourceStateId: state.stateId, informationCutoff: state.informationCutoff, methodologyVersion, normalizationRuleIds: Object.freeze([...ruleIds]), status: 'VALID', inputSnapshotHash, evidenceRefs: Object.freeze([...evidenceRefs, ...fact.evidenceRefs]), provenanceHash })
  assertNormalizedMetric(metric)
  return metric
}

export function buildTtmMetric(issuerId: string, conceptId: string, contributingFacts: readonly FinancialFact[], state: FundamentalState, value: AccountingValue, methodologyVersion: string, evidenceRefs: readonly EvidenceRef[], provenanceHash: string): TtmMetric {
  if (!contributingFacts.length) throw new Error('TTM requires contributing facts')
  if (contributingFacts.some((fact) => fact.issuerId !== issuerId || !state.factIds.includes(fact.factId))) throw new Error('TTM facts must belong to issuer and state')
  if (contributingFacts.some((fact) => Date.parse(fact.availableAt) > Date.parse(state.informationCutoff))) throw new Error('TTM contains future information')
  assertAccountingValue(value)
  return Object.freeze({ metricId: `${state.stateId}:ttm:${conceptId}`, issuerId, conceptId, value, contributingFactIds: Object.freeze(contributingFacts.map((fact) => fact.factId)), informationCutoff: state.informationCutoff, methodologyVersion, status: 'VALID', evidenceRefs: Object.freeze(evidenceRefs), provenanceHash })
}
