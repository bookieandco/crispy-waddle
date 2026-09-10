import type { EvidenceRef } from './financial-intelligence-contracts.js'

/** MONEY-035 — issuer-reported reality contracts. */
export type IssuerStatus = 'ACTIVE' | 'INACTIVE' | 'DISSOLVED' | 'MERGED' | 'UNKNOWN'
export type IssuerIdentifierType = 'CIK' | 'LEI' | 'TAX_ID' | 'LOCAL_REGISTRATION' | 'EXTERNAL_PROVIDER' | 'OTHER'
export type IssuerRelationshipType = 'ISSUER_OF' | 'PARENT' | 'SUBSIDIARY' | 'PREDECESSOR' | 'SUCCESSOR' | 'AFFILIATE'
export type FilingStatus = 'ORIGINAL' | 'AMENDMENT' | 'WITHDRAWN' | 'UNKNOWN'
export type FactStatus = 'REPORTED' | 'AMENDED' | 'RESTATED' | 'WITHDRAWN' | 'CONFLICTING' | 'UNKNOWN'
export type FundamentalStateStatus = 'DATA_COMPLETE' | 'DATA_PARTIAL' | 'DATA_STALE' | 'DATA_CONFLICTING' | 'RESTATEMENT_PENDING' | 'UNUSUAL_PERIOD' | 'CUSTOM_TAXONOMY' | 'INSUFFICIENT_HISTORY'
export type ExactFinancialValue = Readonly<{ coefficient: bigint; scale: number; currency?: string; unit: string }>
export type Issuer = Readonly<{ issuerId: string; legalName: string; formerNames: readonly string[]; jurisdiction?: string; cik?: string; lei?: string; industry?: string; status: IssuerStatus; incorporationDate?: string; fiscalYearEnd?: string; parentIssuerId?: string; evidenceRefs: readonly EvidenceRef[]; provenanceHash: string }>
export type IssuerIdentifier = Readonly<{ identifierId: string; issuerId: string; type: IssuerIdentifierType; value: string; issuer?: string; effectiveAt?: string; expiresAt?: string; evidenceRefs: readonly EvidenceRef[]; provenanceHash: string }>
export type IssuerRelationship = Readonly<{ relationshipId: string; fromIssuerId: string; toIssuerId: string; relationshipType: IssuerRelationshipType; effectiveAt?: string; expiresAt?: string; evidenceRefs: readonly EvidenceRef[]; provenanceHash: string }>
export type Filing = Readonly<{ filingId: string; issuerId: string; accessionNumber: string; formType: string; filingDate: string; acceptedAt: string; periodEnd?: string; amendmentOf?: string; status: FilingStatus; source: string; sourceHash: string; evidenceRefs: readonly EvidenceRef[]; provenanceHash: string }>
export type FilingDocument = Readonly<{ documentId: string; filingId: string; documentName: string; documentType?: string; uri: string; contentHash: string; mimeType?: string; evidenceRefs: readonly EvidenceRef[]; provenanceHash: string }>
export type FinancialFactDimension = Readonly<{ namespace?: string; name: string; value: string }>
export type FinancialFact = Readonly<{ factId: string; issuerId: string; filingId: string; taxonomy: string; concept: string; value: ExactFinancialValue | string; decimals?: number | 'INF'; periodStart?: string; periodEnd?: string; instant?: string; fiscalYear?: number; fiscalPeriod?: string; dimensions: readonly FinancialFactDimension[]; sourceContext?: string; reportedAt: string; availableAt: string; receivedAt: string; status: FactStatus; evidenceRefs: readonly EvidenceRef[]; provenanceHash: string }>
export type FactRevision = Readonly<{ revisionId: string; factId: string; supersedesFactId?: string; revisionType: 'AMENDMENT' | 'RESTATEMENT' | 'CORRECTION' | 'WITHDRAWAL'; revisedAt: string; reason?: string; evidenceRefs: readonly EvidenceRef[]; provenanceHash: string }>
export type FundamentalState = Readonly<{ stateId: string; issuerId: string; informationCutoff: string; factIds: readonly string[]; status: FundamentalStateStatus; derivedAt: string; methodologyVersion: string; inputSnapshotHash: string; evidenceRefs: readonly EvidenceRef[]; provenanceHash: string }>
export type SharkFundamentalInput = Readonly<{ issuerId: string; instrumentId: string; informationCutoff: string; factIds: readonly string[]; evidenceRefs: readonly EvidenceRef[]; inputSnapshotHash: string }>

function assertNonEmpty(value: string, field: string): void { if (!value.trim()) throw new Error(`${field} is required`) }
function assertIsoTimestamp(value: string, field: string): void { assertNonEmpty(value, field); if (Number.isNaN(Date.parse(value))) throw new Error(`${field} must be a valid timestamp`) }

export function assertPointInTimeFact(fact: FinancialFact): void {
  assertNonEmpty(fact.factId, 'factId'); assertNonEmpty(fact.issuerId, 'issuerId'); assertNonEmpty(fact.filingId, 'filingId'); assertNonEmpty(fact.taxonomy, 'taxonomy'); assertNonEmpty(fact.concept, 'concept')
  assertIsoTimestamp(fact.reportedAt, 'reportedAt'); assertIsoTimestamp(fact.availableAt, 'availableAt'); assertIsoTimestamp(fact.receivedAt, 'receivedAt')
  if (Date.parse(fact.availableAt) < Date.parse(fact.reportedAt)) throw new Error('availableAt cannot precede reportedAt')
  if (Date.parse(fact.receivedAt) < Date.parse(fact.availableAt)) throw new Error('receivedAt cannot precede availableAt')
}
export function factWasAvailableAt(fact: FinancialFact, informationCutoff: string): boolean { assertIsoTimestamp(informationCutoff, 'informationCutoff'); assertPointInTimeFact(fact); return Date.parse(fact.availableAt) <= Date.parse(informationCutoff) }
export function selectFactsAtCutoff(facts: readonly FinancialFact[], informationCutoff: string): readonly FinancialFact[] { assertIsoTimestamp(informationCutoff, 'informationCutoff'); return Object.freeze(facts.filter((fact) => factWasAvailableAt(fact, informationCutoff))) }

export function buildFundamentalState(issuerId: string, facts: readonly FinancialFact[], informationCutoff: string, derivedAt: string, methodologyVersion: string, inputSnapshotHash: string, evidenceRefs: readonly EvidenceRef[], provenanceHash: string): FundamentalState {
  assertNonEmpty(issuerId, 'issuerId'); assertIsoTimestamp(informationCutoff, 'informationCutoff'); assertIsoTimestamp(derivedAt, 'derivedAt'); assertNonEmpty(methodologyVersion, 'methodologyVersion'); assertNonEmpty(inputSnapshotHash, 'inputSnapshotHash'); assertNonEmpty(provenanceHash, 'provenanceHash')
  const selected = selectFactsAtCutoff(facts, informationCutoff)
  const status: FundamentalStateStatus = selected.length === 0 ? 'INSUFFICIENT_HISTORY' : selected.some((fact) => fact.status === 'CONFLICTING') ? 'DATA_CONFLICTING' : selected.some((fact) => fact.status === 'RESTATED') ? 'RESTATEMENT_PENDING' : 'DATA_COMPLETE'
  return Object.freeze({ stateId: `${issuerId}:${informationCutoff}:${inputSnapshotHash}`, issuerId, informationCutoff, factIds: Object.freeze(selected.map((fact) => fact.factId)), status, derivedAt, methodologyVersion, inputSnapshotHash, evidenceRefs: Object.freeze([...evidenceRefs]), provenanceHash })
}

export function toSharkFundamentalInput(state: FundamentalState, instrumentId: string, facts: readonly FinancialFact[]): SharkFundamentalInput {
  assertNonEmpty(instrumentId, 'instrumentId'); assertNonEmpty(state.issuerId, 'issuerId')
  const selected = selectFactsAtCutoff(facts, state.informationCutoff).filter((fact) => state.factIds.includes(fact.factId))
  return Object.freeze({ issuerId: state.issuerId, instrumentId, informationCutoff: state.informationCutoff, factIds: Object.freeze(selected.map((fact) => fact.factId)), evidenceRefs: Object.freeze(selected.flatMap((fact) => fact.evidenceRefs)), inputSnapshotHash: state.inputSnapshotHash })
}

/** Returns the append-only revision chain for a fact; no original fact is mutated. */
export function revisionsForFact(revisions: readonly FactRevision[], factId: string): readonly FactRevision[] {
  assertNonEmpty(factId, 'factId')
  return Object.freeze(revisions.filter((revision) => revision.factId === factId || revision.supersedesFactId === factId))
}

/** A withdrawn fact remains in history and is excluded from the active projection. */
export function selectActiveFactsAtCutoff(facts: readonly FinancialFact[], revisions: readonly FactRevision[], informationCutoff: string): readonly FinancialFact[] {
  const selected = selectFactsAtCutoff(facts, informationCutoff)
  const withdrawn = new Set(revisions.filter((revision) => revision.revisionType === 'WITHDRAWAL' && Date.parse(revision.revisedAt) <= Date.parse(informationCutoff)).map((revision) => revision.factId))
  return Object.freeze(selected.filter((fact) => !withdrawn.has(fact.factId) && fact.status !== 'WITHDRAWN'))
}
