import type { EvidenceRef } from './financial-intelligence-contracts.js'

/** MONEY-037 — macro/economic reality and regime contracts. Intelligence only. */
export type EconomicIndicatorType = 'INFLATION' | 'EMPLOYMENT' | 'GROWTH' | 'GDP' | 'CONSUMPTION' | 'PRODUCTION' | 'TRADE' | 'HOUSING' | 'RATES' | 'MONEY_SUPPLY' | 'CREDIT' | 'CONFIDENCE' | 'OTHER'
export type ObservationStatus = 'VALID' | 'REVISED' | 'STALE' | 'MISSING' | 'CONFLICTING' | 'UNVERIFIED' | 'FUTURE_LEAK'
export type MacroRegimeType = 'EXPANSION' | 'SLOWDOWN' | 'RECESSION' | 'REACCELERATION' | 'INFLATIONARY' | 'DISINFLATIONARY' | 'DEFLATIONARY' | 'STAGFLATION' | 'LIQUIDITY_EASING' | 'LIQUIDITY_TIGHTENING' | 'UNKNOWN'
export type MacroFactorType = 'GROWTH' | 'INFLATION' | 'LABOR' | 'LIQUIDITY' | 'FINANCIAL_CONDITIONS' | 'POLICY' | 'CREDIT' | 'HOUSING' | 'CONSUMPTION' | 'TRADE' | 'RISK_APPETITE' | 'OTHER'

export type EconomicIndicator = Readonly<{ indicatorId:string; name:string; type:EconomicIndicatorType; countryOrRegion:string; frequency:string; unit:string; seasonalAdjustment?:string; source:string; methodologyVersion:string; evidenceRefs:readonly EvidenceRef[]; provenanceHash:string }>
export type EconomicVintage = Readonly<{ vintageId:string; indicatorId:string; observationId:string; publishedAt:string; availableAt:string; supersedesObservationId?:string; revisionNumber:number; evidenceRefs:readonly EvidenceRef[]; provenanceHash:string }>
export type EconomicObservation = Readonly<{ observationId:string; indicatorId:string; periodStart?:string; periodEnd?:string; value:number; unit:string; observedAt:string; publishedAt:string; availableAt:string; receivedAt:string; status:ObservationStatus; vintageId?:string; evidenceRefs:readonly EvidenceRef[]; provenanceHash:string }>
export type MacroFactor = Readonly<{ factorId:string; type:MacroFactorType; name:string; indicatorIds:readonly string[]; methodologyVersion:string; evidenceRefs:readonly EvidenceRef[]; provenanceHash:string }>
export type MacroRegime = Readonly<{ regimeId:string; asOf:string; regimeTypes:readonly MacroRegimeType[]; factorStates:Readonly<Record<string,string>>; confidence?:number; evidenceRefs:readonly EvidenceRef[]; methodologyVersion:string; provenanceHash:string }>
export type RegimeTransition = Readonly<{ transitionId:string; fromRegimeId:string; toRegimeId:string; effectiveAt:string; observedAt:string; evidenceRefs:readonly EvidenceRef[]; methodologyVersion:string; provenanceHash:string }>
export type MacroSensitivity = Readonly<{ sensitivityId:string; subjectId:string; factorId:string; horizon:string; coefficient:number; methodologyVersion:string; informationCutoff:string; evidenceRefs:readonly EvidenceRef[]; provenanceHash:string }>
export type MonetaryPolicyEvent = Readonly<{ eventId:string; authority:string; jurisdiction:string; eventType:'RATE_CHANGE'|'QE'|'QT'|'FORWARD_GUIDANCE'|'LIQUIDITY_FACILITY'|'OTHER'; announcedAt:string; effectiveAt?:string; policyRate?:number; evidenceRefs:readonly EvidenceRef[]; provenanceHash:string }>
export type EconomicEvent = Readonly<{ eventId:string; indicatorId?:string; jurisdiction:string; scheduledAt:string; eventType:string; consensusValue?:number; actualValue?:number; evidenceRefs:readonly EvidenceRef[]; provenanceHash:string }>
export type MacroSurprise = Readonly<{ surpriseId:string; eventId:string; expected:number; actual:number; surprise:number; methodologyVersion:string; evidenceRefs:readonly EvidenceRef[]; provenanceHash:string }>
export type MacroSnapshot = Readonly<{ snapshotId:string; informationCutoff:string; observationIds:readonly string[]; vintageIds:readonly string[]; regimeId?:string; transitionIds:readonly string[]; policyEventIds:readonly string[]; methodologyVersion:string; evidenceRefs:readonly EvidenceRef[]; provenanceHash:string }>

function nonEmpty(value:string, field:string):void { if (!value.trim()) throw new Error(`${field} is required`) }
function iso(value:string, field:string):void { nonEmpty(value,field); if (Number.isNaN(Date.parse(value))) throw new Error(`${field} must be a valid timestamp`) }

export function assertEconomicObservation(observation:EconomicObservation):void {
  nonEmpty(observation.observationId,'observationId'); nonEmpty(observation.indicatorId,'indicatorId'); nonEmpty(observation.unit,'unit'); iso(observation.publishedAt,'publishedAt'); iso(observation.availableAt,'availableAt'); iso(observation.receivedAt,'receivedAt'); iso(observation.observedAt,'observedAt')
  if (Date.parse(observation.availableAt) < Date.parse(observation.publishedAt)) throw new Error('availableAt cannot precede publishedAt')
  if (Date.parse(observation.receivedAt) < Date.parse(observation.availableAt)) throw new Error('receivedAt cannot precede availableAt')
}

export function observationWasAvailableAt(observation:EconomicObservation, cutoff:string):boolean { iso(cutoff,'informationCutoff'); assertEconomicObservation(observation); return Date.parse(observation.availableAt) <= Date.parse(cutoff) }

export function selectEconomicObservationsAtCutoff(observations:readonly EconomicObservation[], cutoff:string):readonly EconomicObservation[] { iso(cutoff,'informationCutoff'); return Object.freeze(observations.filter(o => observationWasAvailableAt(o,cutoff))) }

export function assertEconomicVintage(vintage:EconomicVintage):void { nonEmpty(vintage.vintageId,'vintageId'); nonEmpty(vintage.indicatorId,'indicatorId'); nonEmpty(vintage.observationId,'observationId'); iso(vintage.publishedAt,'publishedAt'); iso(vintage.availableAt,'availableAt'); if (Date.parse(vintage.availableAt) < Date.parse(vintage.publishedAt)) throw new Error('vintage availableAt cannot precede publishedAt'); if (!Number.isInteger(vintage.revisionNumber) || vintage.revisionNumber < 0) throw new Error('revisionNumber must be a non-negative integer') }

export function buildMacroSnapshot(observations:readonly EconomicObservation[], vintages:readonly EconomicVintage[], informationCutoff:string, regimeId:string|undefined, transitionIds:readonly string[], policyEventIds:readonly string[], methodologyVersion:string, evidenceRefs:readonly EvidenceRef[], provenanceHash:string):MacroSnapshot {
  iso(informationCutoff,'informationCutoff'); nonEmpty(methodologyVersion,'methodologyVersion'); nonEmpty(provenanceHash,'provenanceHash'); const selected=selectEconomicObservationsAtCutoff(observations,informationCutoff); const selectedIds=new Set(selected.map(o=>o.observationId)); const selectedVintages=vintages.filter(v=>selectedIds.has(v.observationId) && Date.parse(v.availableAt)<=Date.parse(informationCutoff)); return Object.freeze({snapshotId:`macro:${informationCutoff}:${methodologyVersion}`,informationCutoff,observationIds:Object.freeze(selected.map(o=>o.observationId)),vintageIds:Object.freeze(selectedVintages.map(v=>v.vintageId)),regimeId,transitionIds:Object.freeze([...transitionIds]),policyEventIds:Object.freeze([...policyEventIds]),methodologyVersion,evidenceRefs:Object.freeze([...evidenceRefs,...selected.flatMap(o=>o.evidenceRefs),...selectedVintages.flatMap(v=>v.evidenceRefs)]),provenanceHash})
}

export function calculateMacroSurprise(event:EconomicEvent):MacroSurprise|undefined { if (event.consensusValue===undefined || event.actualValue===undefined) return undefined; return Object.freeze({surpriseId:`${event.eventId}:surprise`,eventId:event.eventId,expected:event.consensusValue,actual:event.actualValue,surprise:event.actualValue-event.consensusValue,methodologyVersion:'difference-v1',evidenceRefs:Object.freeze([...event.evidenceRefs]),provenanceHash:event.provenanceHash}) }
