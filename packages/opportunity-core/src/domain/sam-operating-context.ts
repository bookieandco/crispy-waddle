import type { ProviderDiscoveryChannel, SamEvaluationMethod } from './sam-operating-system.js'

export type SamSearchProfileV2={
  id:string
  noticeTypes:string[]
  naicsCodes:string[]
  pscCodes:string[]
  agencies:string[]
  offices:string[]
  setAsides:string[]
  places:string[]
  keywords:string[]
  postedFrom?:string
  postedTo?:string
  responseFrom?:string
  responseTo?:string
  activeOnly:boolean
  valueMin?:number
  valueMax?:number
  cursor?:string
}

export type SamNoticeVersion={
  opportunityId:string
  versionId:string
  noticeType:string
  capturedAt:string
  sourceRef:string
  contentDigest:string
  supersedesVersionId?:string
  amendmentNumber?:string
}

export type BuyingOfficeObservation={
  id:string
  agency:string
  office:string
  contactRef?:string
  opportunityId:string
  noticeType:string
  observedAt:string
  evidenceRefs:string[]
}

export type IncumbentIntelligence={
  opportunityId:string
  incumbentProviderName?:string
  incumbentProviderId?:string
  priorContractNumber?:string
  priorAwardValue?:number
  priorPeriodOfPerformance?:string
  priorNaics?:string
  priorPsc?:string
  priorBuyingOffice?:string
  evidenceRefs:string[]
  status:'verified'|'partial'|'unknown'
}

export type HistoricalProviderRelationship={
  id:string
  awardRef:string
  primeProviderId?:string
  relatedProviderId?:string
  relationship:'confirmed_subcontractor'|'confirmed_supplier'|'potential_provider'|'unknown'
  geography?:string
  requirementTags:string[]
  evidenceRefs:string[]
  inferred:boolean
}

export type ContractVehicleEvidence={
  id:string
  holderEntityRef:string
  vehicleType:string
  vehicleNumber?:string
  scope:string[]
  activeFrom?:string
  activeUntil?:string
  evidenceRef:string
  verified:boolean
  applicableToOpportunity:'yes'|'no'|'review_required'
}

export type SourcesSoughtResponseField={
  id:string
  label:string
  required:boolean
  kind:'company_identity'|'uei'|'cage'|'socioeconomic_status'|'capability'|'experience'|'pricing'|'staffing'|'technical'|'vehicle'|'other'
  sourceRef:string
}

export type SourcesSoughtResponseSchema={
  opportunityId:string
  fields:SourcesSoughtResponseField[]
  writtenResponseOnly?:boolean
  maxFileSizeMb?:number
  pageLimit?:number
  dueAt?:string
  contactRef?:string
  sourceRefs:string[]
}

export type SolicitationSiteVisit={
  opportunityId:string
  required:boolean
  date?:string
  location?:string
  registrationDeadline?:string
  attendanceRules:string[]
  questionsDeadline?:string
  attendeeListAvailable:'yes'|'no'|'unknown'
  attendeeEvidenceRef?:string
  providerParticipantRefs:string[]
  sourceRefs:string[]
}

export type ProviderScopePacket={
  id:string
  opportunityId:string
  providerId:string
  requirementIds:string[]
  scopeTasks:string[]
  quantities:string[]
  performanceLocation?:string
  schedule:string[]
  performanceStandards:string[]
  requiredCredentialRefs:string[]
  governmentFurnishedItems:string[]
  providerFurnishedItems:string[]
  siteVisitRef?:string
  quoteDueAt?:string
  assumptions:string[]
  questions:string[]
  sourceEvidenceRefs:string[]
  outreachAuthorized:false
}

export type ProviderRelationshipEventKind=
  |'discovered'|'referred'|'outreach_prepared'|'outreach_sent'|'response_received'|'quote_received'
  |'provider_reconfirmed'|'provider_declined'|'capacity_changed'|'quote_refreshed'|'award_pending_update'
  |'contracted'|'performance'|'invoice'|'payment'

export type ProviderRelationshipEvent={
  id:string
  providerId:string
  opportunityId:string
  kind:ProviderRelationshipEventKind
  occurredAt:string
  channel?:string
  evidenceRefs:string[]
  notes?:string
}

export type ProviderContinuityAssessment={
  providerId:string
  opportunityId:string
  quoteStillValid:boolean
  primaryContactCurrent:boolean
  capacityReconfirmed:boolean
  replacementContactRequired:boolean
  status:'QUOTE_CONTINUITY_OK'|'RECONFIRM_PROVIDER'
  reasons:string[]
}

export function assessProviderContinuity(input:{
  providerId:string
  opportunityId:string
  quoteStillValid:boolean
  primaryContactCurrent:boolean
  capacityReconfirmed:boolean
}):ProviderContinuityAssessment{
  const reasons:string[]=[]
  if(!input.quoteStillValid)reasons.push('Provider pricing evidence is stale or expired.')
  if(!input.primaryContactCurrent)reasons.push('Commercial contact continuity is unresolved.')
  if(!input.capacityReconfirmed)reasons.push('Provider capacity has not been reconfirmed for the current procurement cycle.')
  return {...input,replacementContactRequired:!input.primaryContactCurrent,status:reasons.length?'RECONFIRM_PROVIDER':'QUOTE_CONTINUITY_OK',reasons}
}

export type PrimeRelationshipEventKind=
  |'introduced'|'vendor_registration_started'|'vendor_registration_complete'|'capability_statement_prepared'
  |'capability_statement_sent'|'meeting_held'|'rfq_received'|'quote_submitted'|'subcontract_offered'
  |'subcontract_signed'|'work_started'|'invoice_submitted'|'payment_received'|'renewal_requested'|'referral_received'

export type PrimeRelationshipEvent={
  id:string
  primeId:string
  opportunityId?:string
  kind:PrimeRelationshipEventKind
  occurredAt:string
  evidenceRefs:string[]
  amount?:number
  currency?:string
}

export type PrimeAccountPerformance={
  primeId:string
  pursuitCount:number
  winCount:number
  recognizedRevenue:number
  averageDaysToPayment?:number
  evidenceRefs:string[]
  intelligenceOnly:true
}

export function summarizePrimeAccount(primeId:string,events:PrimeRelationshipEvent[]):PrimeAccountPerformance{
  const rows=events.filter(x=>x.primeId===primeId&&x.evidenceRefs.length)
  const pursuitIds=new Set(rows.filter(x=>x.opportunityId&&['rfq_received','quote_submitted','subcontract_offered','subcontract_signed'].includes(x.kind)).map(x=>x.opportunityId!))
  const wins=new Set(rows.filter(x=>x.kind==='subcontract_signed'&&x.opportunityId).map(x=>x.opportunityId!))
  const revenue=rows.filter(x=>x.kind==='payment_received'&&Number.isFinite(x.amount)).reduce((n,x)=>n+Math.max(0,x.amount??0),0)
  return {primeId,pursuitCount:pursuitIds.size,winCount:wins.size,recognizedRevenue:revenue,evidenceRefs:[...new Set(rows.flatMap(x=>x.evidenceRefs))],intelligenceOnly:true}
}

export type ContractKickoffPacket={
  opportunityId:string
  awardRef:string
  governmentContactRefs:string[]
  providerContactRefs:string[]
  rolesAndResponsibilities:string[]
  performanceStart?:string
  scheduleRefs:string[]
  deliveryLocationRefs:string[]
  accessRequirementRefs:string[]
  communicationsCadence:string[]
  issueEscalationPath:string[]
  invoiceInstructionRefs:string[]
  acceptanceProcessRefs:string[]
  changeControlRefs:string[]
  sourceEvidenceRefs:string[]
  communicationAuthorized:false
}

export type ContractChangeOrder={
  id:string
  opportunityId:string
  requestedAt:string
  requestSourceRef:string
  scopeImpact:string[]
  costImpact?:number
  scheduleImpact?:string
  governmentAuthorizationRef?:string
  providerAuthorizationRef?:string
  status:'requested'|'assessed'|'authorized'|'implemented'|'closed'|'rejected'
  evidenceRefs:string[]
  executionAuthorized:false
  paymentAuthorized:false
}

export type ContractCommunicationEvent={
  id:string
  opportunityId:string
  side:'government'|'provider'
  kind:'instruction'|'question'|'status_update'|'issue'|'acceptance'|'deficiency'|'invoice'|'payment'|'other'
  occurredAt:string
  messageRef:string
  evidenceRefs:string[]
}

export type SamEvaluationProfile={
  opportunityId:string
  method:SamEvaluationMethod
  factors:Array<{id:string;label:string;relativeImportance?:string;passFail:boolean;sourceRef:string}>
  priceEvaluationMethod?:string
  evidenceRefs:string[]
}

export type DiscoveryProvenanceRecord={
  providerId:string
  opportunityId:string
  channel:ProviderDiscoveryChannel
  sourceRef:string
  discoveryOnly:boolean
  observedAt:string
}

export function discoveryChannelRequiresCorroboration(channel:ProviderDiscoveryChannel):boolean{
  return ['web_search','professional_network','public_social_business_page','marketplace_directory','provider_referral','expert_referral','site_visit_attendee','manual_owner_network'].includes(channel)
}
