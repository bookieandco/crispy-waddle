export type SamAuthorityBoundary={
  humanApprovalRequired:true
  outreachAuthorized:false
  bidSubmissionAuthorized:false
  contractExecutionAuthorized:false
  paymentAuthorized:false
}

export type SamNoticeLifecycleStage='discovery'|'sources_sought'|'presolicitation'|'solicitation'|'amendment'|'award'|'execution'|'closeout'
export type SamCaptureValue='low'|'medium'|'high'
export type SamAwardReadiness='not_award_stage'|'developing'|'ready_for_pursuit'

export type SamCaptureAssessment=SamAuthorityBoundary&{
  opportunityId:string
  stage:SamNoticeLifecycleStage
  captureValue:SamCaptureValue
  awardReadiness:SamAwardReadiness
  reasons:string[]
}

export function assessSamCapture(input:{
  opportunityId:string
  stage:SamNoticeLifecycleStage
  buyingOfficeKnown?:boolean
  incumbentEvidence?:boolean
  responseRequested?:boolean
  activeSolicitation?:boolean
}):SamCaptureAssessment{
  const reasons:string[]=[]
  let captureValue:SamCaptureValue='low'
  if(input.stage==='sources_sought'||input.stage==='presolicitation'){captureValue='high';reasons.push('Early market-research/capture stage can shape pursuit preparation.')}
  else if(input.stage==='solicitation'||input.stage==='amendment'){captureValue='medium';reasons.push('Active procurement evidence supports near-term pursuit decisions.')}
  if(input.buyingOfficeKnown){captureValue='high';reasons.push('Buying-office evidence is available.')}
  if(input.incumbentEvidence)reasons.push('Historical/incumbent evidence is available for comparison.')
  if(input.responseRequested)reasons.push('Notice requests a response; response schema must control the package.')
  const awardReadiness:SamAwardReadiness=input.activeSolicitation||input.stage==='solicitation'||input.stage==='amendment'?'ready_for_pursuit':input.stage==='sources_sought'||input.stage==='presolicitation'?'developing':'not_award_stage'
  return {opportunityId:input.opportunityId,stage:input.stage,captureValue,awardReadiness,reasons,humanApprovalRequired:true,outreachAuthorized:false,bidSubmissionAuthorized:false,contractExecutionAuthorized:false,paymentAuthorized:false}
}

export type ProviderDiscoveryChannel=
  |'sam_entity'|'sam_award'|'usaspending'|'fpds'|'entity_directory'|'local_business'|'web_search'
  |'professional_network'|'public_social_business_page'|'marketplace_directory'|'provider_referral'
  |'expert_referral'|'site_visit_attendee'|'manual_owner_network'

export type ProviderBenchCandidate={
  providerId:string
  requirementIds:string[]
  discoveryChannels:ProviderDiscoveryChannel[]
  evidenceRefs:string[]
  qualified:boolean
  available?:boolean
}

export type ProviderBenchAssessment={
  targetCandidateCount:number
  candidateCount:number
  corroboratedCount:number
  qualifiedCount:number
  status:'COVERAGE_HEALTHY'|'MARKET_CONSTRAINED'|'DISCOVERY_INCOMPLETE'
  blockers:string[]
}

export function assessProviderBench(candidates:ProviderBenchCandidate[],options:{targetCandidateCount?:number;marketConstrained?:boolean}={}):ProviderBenchAssessment{
  const target=Math.max(1,Math.floor(options.targetCandidateCount??5))
  const corroborated=candidates.filter(x=>new Set(x.discoveryChannels).size>=2&&x.evidenceRefs.length>0)
  const qualified=corroborated.filter(x=>x.qualified&&x.available!==false)
  const status:ProviderBenchAssessment['status']=qualified.length>=target?'COVERAGE_HEALTHY':options.marketConstrained&&qualified.length>0?'MARKET_CONSTRAINED':'DISCOVERY_INCOMPLETE'
  const blockers=status==='DISCOVERY_INCOMPLETE'?['Qualified provider coverage '+qualified.length+'/'+target+' is below target and market constraint is not evidenced.']:[]
  return {targetCandidateCount:target,candidateCount:candidates.length,corroboratedCount:corroborated.length,qualifiedCount:qualified.length,status,blockers}
}

export type ProviderReferral={
  id:string
  opportunityId:string
  referringProviderId?:string
  referredProviderId?:string
  referredProviderName:string
  requirementIds:string[]
  reason?:string
  evidenceRef:string
  occurredAt:string
}

export type ProviderCommunicationProfile={
  providerId:string
  primaryContactRef?:string
  preferredContactMethod?:'email'|'phone'|'text'|'whatsapp'|'slack'|'other'
  allowedContactMethods:string[]
  lastSuccessfulChannel?:string
  lastResponseAt?:string
  averageResponseLatencyHours?:number
  doNotContact:boolean
  evidenceRefs:string[]
}

export type SamPriceEvidenceKind=
  |'FIRM_VENDOR_QUOTE'|'BUDGETARY_VENDOR_QUOTE'|'WRITTEN_ESTIMATE'|'PAID_EXPERT_ESTIMATE'
  |'HISTORICAL_AWARD_COMPARABLE'|'CATALOG_OR_RATE_CARD'|'MODEL_ONLY_ESTIMATE'

export type SamPriceEvidence={
  id:string
  kind:SamPriceEvidenceKind
  amount:number
  currency:string
  scopeRef:string
  evidenceRef:string
  providerId?:string
  validUntil?:string
  assumptions:string[]
}

export type QuoteCoverageAssessment={
  usableObservationCount:number
  vendorObservationCount:number
  historicalComparableCount:number
  confidence:'HIGH'|'MEDIUM'|'LOW'
  blockers:string[]
}

export function assessQuoteCoverage(evidence:SamPriceEvidence[],now=new Date().toISOString()):QuoteCoverageAssessment{
  const usable=evidence.filter(x=>Number.isFinite(x.amount)&&x.amount>=0&&x.evidenceRef.trim()&&(!x.validUntil||x.validUntil>=now))
  const vendorKinds=new Set<SamPriceEvidenceKind>(['FIRM_VENDOR_QUOTE','BUDGETARY_VENDOR_QUOTE','WRITTEN_ESTIMATE'])
  const vendor=usable.filter(x=>vendorKinds.has(x.kind)&&Boolean(x.providerId))
  const historical=usable.filter(x=>x.kind==='HISTORICAL_AWARD_COMPARABLE')
  let confidence:QuoteCoverageAssessment['confidence']='LOW'
  if(vendor.some(x=>x.kind==='FIRM_VENDOR_QUOTE')&&usable.length>=2)confidence='HIGH'
  else if(vendor.length||historical.length)confidence='MEDIUM'
  const blockers:string[]=[]
  if(!vendor.length)blockers.push('No evidence-backed current provider pricing observation is available.')
  if(usable.length>0&&usable.every(x=>x.kind==='MODEL_ONLY_ESTIMATE'))blockers.push('Model-only estimates cannot certify provider pricing.')
  return {usableObservationCount:usable.length,vendorObservationCount:vendor.length,historicalComparableCount:historical.length,confidence,blockers}
}

export type SolicitationConflict={
  id:string
  conflictType:'pricing'|'period'|'scope'|'submission'|'evaluation'|'attachment_version'|'other'
  sourceRefs:string[]
  statementA:string
  statementB:string
  materiality:'low'|'medium'|'high'
  clarificationRequired:boolean
  resolvedByRef?:string
}

export type SamEvaluationMethod='price_only'|'lpta'|'best_value_tradeoff'|'technical_price_tradeoff'|'qualifications_based'|'other'
export type SamPricingBasis='hourly'|'daily'|'monthly'|'unit'|'lot'|'fixed_price'|'cost_reimbursement'|'mixed'

export type SamPricingPeriod={
  id:string
  label:string
  quantity:number
  unit:string
  unitPrice:number
  escalationBasis?:string
  evidenceRefs:string[]
}

export type LaborClassificationCandidate={
  code:string
  title:string
  baseWage:number
  fringe:number
  sourceRef:string
  dutyMatchEvidenceRefs:string[]
  confidence:number
  verified:boolean
  verificationRef?:string
}

export type SamPricingScenario={
  scenarioId:string
  strategy:'SELF_PERFORM'|'PRIME_WITH_SUB'|'TEAMING'|'HYBRID'
  basis:SamPricingBasis
  evaluationMethod:SamEvaluationMethod
  periods:SamPricingPeriod[]
  laborCost:number
  providerCost:number
  materialsCost:number
  logisticsCost:number
  overhead:number
  contingency:number
  financingCost:number
  totalCost:number
  totalEvaluatedPrice:number
  estimatedProfit:number
  estimatedMarginPercent:number
  assumptions:string[]
  blockers:string[]
}

const nonnegative=(n:number|undefined)=>typeof n==='number'&&Number.isFinite(n)&&n>0?n:0
const uniq=(xs:string[])=>[...new Set(xs.map(x=>x.trim()).filter(Boolean))]

export function buildSamPricingScenario(input:{
  scenarioId:string
  strategy:SamPricingScenario['strategy']
  basis:SamPricingBasis
  evaluationMethod:SamEvaluationMethod
  periods:SamPricingPeriod[]
  laborCost?:number
  providerCost?:number
  materialsCost?:number
  logisticsCost?:number
  overhead?:number
  contingency?:number
  financingCost?:number
  assumptions?:string[]
}):SamPricingScenario{
  const totalEvaluatedPrice=input.periods.reduce((n,p)=>n+nonnegative(p.quantity)*nonnegative(p.unitPrice),0)
  const laborCost=nonnegative(input.laborCost),providerCost=nonnegative(input.providerCost),materialsCost=nonnegative(input.materialsCost),logisticsCost=nonnegative(input.logisticsCost),overhead=nonnegative(input.overhead),contingency=nonnegative(input.contingency),financingCost=nonnegative(input.financingCost)
  const totalCost=laborCost+providerCost+materialsCost+logisticsCost+overhead+contingency+financingCost
  const estimatedProfit=totalEvaluatedPrice-totalCost
  const estimatedMarginPercent=totalEvaluatedPrice>0?Math.round(estimatedProfit/totalEvaluatedPrice*10000)/100:0
  const blockers:string[]=[]
  if(!input.periods.length||totalEvaluatedPrice<=0)blockers.push('Solicitation pricing periods must produce a positive evaluated price.')
  if(estimatedProfit<=0)blockers.push('Pricing scenario is not modeled as profitable.')
  return {scenarioId:input.scenarioId,strategy:input.strategy,basis:input.basis,evaluationMethod:input.evaluationMethod,periods:input.periods,laborCost,providerCost,materialsCost,logisticsCost,overhead,contingency,financingCost,totalCost,totalEvaluatedPrice,estimatedProfit,estimatedMarginPercent,assumptions:uniq(input.assumptions??[]),blockers}
}

export type SamCashFlowEvent={
  id:string
  date:string
  amount:number
  direction:'OUTFLOW'|'INFLOW'
  kind:'provider'|'materials'|'shipping'|'tax_fee'|'payroll'|'mobilization'|'bond_insurance'|'government_receipt'|'other'
  certainty:'verified'|'estimated'|'assumed'
  evidenceRef:string
}

export type SamFundingFacility={
  id:string
  type:'business_cash'|'supplier_terms'|'line_of_credit'|'business_loan'|'receivables_finance'|'prime_accelerated_payment'|'credit_card'|'private_financing'|'personal_capital'
  maximumAvailable:number
  availableFromStage:'PRE_BID'|'AWARD_RECEIVED'|'PURCHASE_ORDER_RECEIVED'|'DELIVERY_ACCEPTED'|'INVOICE_ISSUED'|'RECEIVABLE_CONFIRMED'
  estimatedFinanceCost:number
  verified:boolean
  evidenceRefs:string[]
}

export type SamFundingReadiness={
  peakCashRequirement:number
  usableExecutionCapital:number
  fundingGap:number
  verifiedFacilityCapacity:number
  estimatedFinanceCost:number
  status:'FUNDED'|'CONDITIONAL'|'BLOCKED'
  blockers:string[]
  assumptions:string[]
}

export function assessSamFunding(input:{
  events:SamCashFlowEvent[]
  availableBusinessCash:number
  protectedReserve:number
  facilities?:SamFundingFacility[]
}):SamFundingReadiness{
  const events=[...input.events].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))
  let cumulative=0,peak=0
  const assumptions:string[]=[]
  for(const e of events){
    const amount=nonnegative(e.amount)
    cumulative+=e.direction==='INFLOW'?amount:-amount
    peak=Math.max(peak,-cumulative)
    if(e.certainty!=='verified')assumptions.push(e.id+' is '+e.certainty+'.')
  }
  const usableExecutionCapital=Math.max(0,nonnegative(input.availableBusinessCash)-nonnegative(input.protectedReserve))
  const facilities=(input.facilities??[]).filter(x=>x.verified&&x.evidenceRefs.length&&x.availableFromStage!=='DELIVERY_ACCEPTED'&&x.availableFromStage!=='INVOICE_ISSUED'&&x.availableFromStage!=='RECEIVABLE_CONFIRMED')
  const verifiedFacilityCapacity=facilities.reduce((n,x)=>n+nonnegative(x.maximumAvailable),0)
  const estimatedFinanceCost=facilities.reduce((n,x)=>n+nonnegative(x.estimatedFinanceCost),0)
  const fundingGap=Math.max(0,peak-usableExecutionCapital-verifiedFacilityCapacity)
  const blockers:string[]=[]
  if(fundingGap>0)blockers.push('Peak pre-receipt cash need exceeds usable verified capital by '+fundingGap.toFixed(2)+'.')
  if(events.some(x=>x.certainty==='assumed'))blockers.push('Material cash-flow assumptions require human review before execution certification.')
  const status:SamFundingReadiness['status']=fundingGap>0?'BLOCKED':blockers.length?'CONDITIONAL':'FUNDED'
  return {peakCashRequirement:peak,usableExecutionCapital,fundingGap,verifiedFacilityCapacity,estimatedFinanceCost,status,blockers,assumptions:uniq(assumptions)}
}

export type ProposalClaimKind='SOLICITATION_FACT'|'PRIME_VERIFIED_FACT'|'TEAM_MEMBER_VERIFIED_FACT'|'QUOTE_FACT'|'MODELED_ASSUMPTION'|'UNSUPPORTED'
export type ProposalTrace={
  requirementId:string
  sourceRef:string
  mandatory:boolean
  evaluationFactor?:string
  responseSectionRef?:string
  evidenceRefs:string[]
  claimKinds:ProposalClaimKind[]
}

export type SamProposalReadiness={
  status:'DRAFT'|'REVIEW_REQUIRED'|'READY_FOR_HUMAN_REVIEW'
  uncoveredRequirementIds:string[]
  unsupportedRequirementIds:string[]
  blockers:string[]
  bidSubmissionAuthorized:false
}

export function assessSamProposalReadiness(traces:ProposalTrace[],conflicts:SolicitationConflict[]=[]):SamProposalReadiness{
  const required=traces.filter(x=>x.mandatory)
  const uncovered=required.filter(x=>!x.responseSectionRef||!x.evidenceRefs.length).map(x=>x.requirementId)
  const unsupported=required.filter(x=>x.claimKinds.includes('UNSUPPORTED')).map(x=>x.requirementId)
  const unresolvedConflicts=conflicts.filter(x=>x.clarificationRequired&&!x.resolvedByRef&&x.materiality==='high')
  const blockers=[
    ...uncovered.map(x=>'Mandatory requirement lacks an evidence-backed response: '+x),
    ...unsupported.map(x=>'Mandatory response contains unsupported claim: '+x),
    ...unresolvedConflicts.map(x=>'Material solicitation conflict unresolved: '+x.id),
  ]
  const status:SamProposalReadiness['status']=!traces.length?'DRAFT':blockers.length?'REVIEW_REQUIRED':'READY_FOR_HUMAN_REVIEW'
  return {status,uncoveredRequirementIds:uncovered,unsupportedRequirementIds:unsupported,blockers,bidSubmissionAuthorized:false}
}

export type PrimeAccount={
  primeId:string
  legalName:string
  agencies:string[]
  naicsCodes:string[]
  activeAwardRefs:string[]
  supplierPortal?:string
  relationshipEvidenceRefs:string[]
}

export type PrimeSubcontractOpportunity={
  id:string
  primeId:string
  requirementIds:string[]
  revenue:number
  deliveryCost:number
  financingCost:number
  paymentTermsDays?:number
  evidenceRefs:string[]
}

export function assessPrimeSubcontractOpportunity(input:PrimeSubcontractOpportunity){
  const blockers:string[]=[]
  const margin=input.revenue-nonnegative(input.deliveryCost)-nonnegative(input.financingCost)
  if(!input.evidenceRefs.length)blockers.push('Prime subcontract opportunity lacks evidence.')
  if(input.revenue<=0)blockers.push('Subcontract revenue must be positive.')
  if(margin<=0)blockers.push('Subcontract margin is not positive.')
  if(input.paymentTermsDays===undefined)blockers.push('Prime payment terms are unresolved.')
  return {opportunityId:input.id,estimatedProfit:margin,estimatedMarginPercent:input.revenue>0?Math.round(margin/input.revenue*10000)/100:0,status:blockers.length?'review_required' as const:'commercially_viable' as const,blockers,humanApprovalRequired:true as const,outreachAuthorized:false as const,contractExecutionAuthorized:false as const,paymentAuthorized:false as const}
}

export type ProviderOnboardingPacket={
  providerId:string
  opportunityId:string
  executedSubcontractRef?:string
  confidentialityStatus:'not_required'|'pending'|'complete'
  taxDocumentationStatus:'rule_review'|'pending'|'complete'
  paymentTermsRef?:string
  purchaseOrderRef?:string
  scopeExpectationRefs:string[]
  qualityCriteriaRefs:string[]
  siteAccessStatus:'not_required'|'pending'|'complete'
  communicationProfile?:ProviderCommunicationProfile
  acceptanceCriteriaRefs:string[]
  backupProviderIds:string[]
  complianceEvidenceRefs:string[]
}

export type ProviderReadyAssessment={
  status:'PROVIDER_IDENTIFIED'|'PROVIDER_CONTRACTED'|'PROVIDER_READY_FOR_PERFORMANCE'
  blockers:string[]
}

export function assessProviderReady(packet:ProviderOnboardingPacket):ProviderReadyAssessment{
  const blockers:string[]=[]
  if(!packet.executedSubcontractRef)return {status:'PROVIDER_IDENTIFIED',blockers:['Executed subcontract is not recorded.']}
  if(packet.confidentialityStatus==='pending')blockers.push('Required confidentiality paperwork is pending.')
  if(packet.taxDocumentationStatus!=='complete')blockers.push('Provider tax-documentation review is incomplete.')
  if(!packet.paymentTermsRef)blockers.push('Written provider payment terms are missing.')
  if(!packet.purchaseOrderRef)blockers.push('Provider work authorization/purchase order is missing.')
  if(!packet.scopeExpectationRefs.length)blockers.push('Written execution expectations are missing.')
  if(!packet.qualityCriteriaRefs.length)blockers.push('Quality-control criteria are missing.')
  if(packet.siteAccessStatus==='pending')blockers.push('Required site-access readiness is incomplete.')
  if(!packet.acceptanceCriteriaRefs.length)blockers.push('Acceptance criteria are missing.')
  if(!packet.complianceEvidenceRefs.length)blockers.push('Provider onboarding lacks compliance evidence.')
  return {status:blockers.length?'PROVIDER_CONTRACTED':'PROVIDER_READY_FOR_PERFORMANCE',blockers}
}

export type ProviderPurchaseOrder={
  poNumber:string
  opportunityId:string
  providerId:string
  subcontractRef:string
  authorizedScopeRefs:string[]
  amount:number
  currency:string
  performanceStart?:string
  performanceEnd?:string
  deliveryLocation?:string
  paymentTermsRef:string
  changeOrderRequiredForOverage:true
  evidenceRefs:string[]
  paymentAuthorized:false
}

export type GovernmentAcceptanceRecord={
  id:string
  opportunityId:string
  deliverableId:string
  acceptedByRef:string
  acceptanceDate:string
  condition:'accepted'|'accepted_with_exceptions'|'rejected'
  exceptionRefs:string[]
  sourceDocumentRef:string
  invoiceEligible:boolean
}

export type ContractInvoiceState='DRAFT'|'READY_FOR_REVIEW'|'AUTHORIZED_FOR_SUBMISSION'|'SUBMITTED'|'ACCEPTED'|'REJECTED'|'RESUBMITTED'|'PAID'|'OVERDUE'
export type ContractInvoice={
  invoiceId:string
  opportunityId:string
  awardRef:string
  deliverableRefs:string[]
  acceptanceRefs:string[]
  amount:number
  currency:string
  invoiceMethod:string
  status:ContractInvoiceState
  evidenceRefs:string[]
  submissionAuthorized:false
  paymentAuthorized:false
}

export type SamOperatingCertification=SamAuthorityBoundary&{
  opportunityId:string
  status:'BLOCKED'|'READY_FOR_HUMAN_SUBMISSION_REVIEW'|'EXECUTION_PLANNING'|'PROVIDER_READY_FOR_PERFORMANCE'
  blockers:string[]
}

export function certifySamOperatingReadiness(input:{
  opportunityId:string
  proposal?:SamProposalReadiness
  pricing?:SamPricingScenario
  quoteCoverage?:QuoteCoverageAssessment
  funding?:SamFundingReadiness
  provider?:ProviderReadyAssessment
  awardRecorded?:boolean
}):SamOperatingCertification{
  const blockers:string[]=[]
  if(input.pricing?.blockers.length)blockers.push(...input.pricing.blockers)
  if(input.quoteCoverage?.blockers.length)blockers.push(...input.quoteCoverage.blockers)
  if(input.funding&&input.funding.status==='BLOCKED')blockers.push(...input.funding.blockers)
  if(!input.awardRecorded){
    if(!input.proposal||input.proposal.status!=='READY_FOR_HUMAN_REVIEW')blockers.push(...(input.proposal?.blockers??['Proposal readiness is incomplete.']))
    return {opportunityId:input.opportunityId,status:blockers.length?'BLOCKED':'READY_FOR_HUMAN_SUBMISSION_REVIEW',blockers:uniq(blockers),humanApprovalRequired:true,outreachAuthorized:false,bidSubmissionAuthorized:false,contractExecutionAuthorized:false,paymentAuthorized:false}
  }
  if(!input.provider)return {opportunityId:input.opportunityId,status:'EXECUTION_PLANNING',blockers:['Provider onboarding has not been assessed.'],humanApprovalRequired:true,outreachAuthorized:false,bidSubmissionAuthorized:false,contractExecutionAuthorized:false,paymentAuthorized:false}
  if(input.provider.status!=='PROVIDER_READY_FOR_PERFORMANCE')blockers.push(...input.provider.blockers)
  return {opportunityId:input.opportunityId,status:blockers.length?'BLOCKED':'PROVIDER_READY_FOR_PERFORMANCE',blockers:uniq(blockers),humanApprovalRequired:true,outreachAuthorized:false,bidSubmissionAuthorized:false,contractExecutionAuthorized:false,paymentAuthorized:false}
}
