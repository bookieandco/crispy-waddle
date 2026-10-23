/**
 * PROCURE.NATIONAL.ACTIVATE.20–.24: evidence-first research acceptance only.
 * A public official source, a provider search result or a future listed bid
 * cannot automatically become an active feed, qualified prime or ready bid.
 */
export type AdapterCanaryTrial={
 id:string;adapterKey:string;observedAt:string;httpStatus:number|null;
 parseSucceeded:boolean;observationCount:number;stableExternalIdCount:number;
 duplicateExternalIdCount:number;provenanceComplete:boolean;accessReviewApproved:boolean;
 errorCode:string|null;
}
export type SourceCanaryStatus={
 sourceId:string;sourceUrl:string;adapterKey:string|null;adapterStatus:string;
 accessReviewStatus:string;officiallyVerified:boolean;certifiedAt:string|null;
}
export function assessSourceCanary(input:{
 source:SourceCanaryStatus;expectedAdapterKey:string;
 trials:AdapterCanaryTrial[];accessEvidenceRefs:string[];fullBidDocumentsVerified:boolean;
}){
 const blockers:string[]=[];
 const s=input.source;
 if(!s.officiallyVerified)blockers.push('official_buyer_provenance_missing');
 if(!['approved_public_official','approved_platform'].includes(s.accessReviewStatus))
  blockers.push('source_access_review_not_approved');
 // Recorded database status alone is NOT authorization to ignore robots,
 // platform terms, vendor registration, or a source 403 response.
 if(input.accessEvidenceRefs.length===0)blockers.push('robots_and_terms_approval_evidence_missing');
 if(s.adapterKey!==input.expectedAdapterKey)blockers.push('exact_parser_version_not_commissioned');
 if(input.trials.length<3)blockers.push('three_independent_live_trials_required');
 const relevant=input.trials.filter(t=>t.adapterKey===input.expectedAdapterKey);
 const distinct=new Set(relevant.map(t=>t.id));
 const instants=new Set(relevant.map(t=>t.observedAt));
 const good=relevant.filter(t=>t.httpStatus===200&&t.parseSucceeded&&
  t.accessReviewApproved&&t.provenanceComplete&&t.duplicateExternalIdCount===0&&
  t.observationCount>0&&t.stableExternalIdCount>=t.observationCount);
 if(good.length<3||distinct.size<3||instants.size<3)
  blockers.push('three_distinct_successful_exact_parser_trials_required');
 if(input.trials.some(t=>t.httpStatus===403))blockers.push('source_http_403_requires_access_remediation');
 if(input.trials.some(t=>t.errorCode?.startsWith('robots_')))blockers.push('robots_access_deny_requires_owner_review');
 if(!input.fullBidDocumentsVerified)blockers.push('full_buyer_planholder_bid_package_missing');
 if(!s.certifiedAt)blockers.push('source_not_commissioned');
 // A fully evidenced assessment still cannot itself authorize a DB status change.
 return {sourceId:s.sourceId,readOnlyTrialCount:input.trials.length,
  successfulExactParserTrials:good.length,
  siteAccessApprovedInRegistry:['approved_public_official','approved_platform'].includes(s.accessReviewStatus),
  sourceCertifiedNow:Boolean(s.certifiedAt)&&s.adapterStatus==='active',
  blockers:[...new Set(blockers)],
  disposition:!s.officiallyVerified?'block':'research_only',
  liveFeedActivationAuthorized:false,externalFetchAuthorized:false,
  buyerContactAuthorized:false,bidSubmissionAuthorized:false};
}

export type PrimeQualificationGate=
 'legal_business_identity'|'cslb_current_trade_class'|'dir_public_works_current'|
 'sam_and_state_exclusions'|'license_and_trade_scope'|'surety_bonding_capacity'|
 'insurance_and_workers_comp'|'prevailing_wage_labor'|'project_capacity_and_area'|
 'subcontract_legal_structure'|'teaming_consent_signed'|'written_current_quote';
export const PRIME_QUALIFICATION_GATES:readonly PrimeQualificationGate[]=[
 'legal_business_identity','cslb_current_trade_class','dir_public_works_current',
 'sam_and_state_exclusions','license_and_trade_scope','surety_bonding_capacity',
 'insurance_and_workers_comp','prevailing_wage_labor','project_capacity_and_area',
 'subcontract_legal_structure','teaming_consent_signed','written_current_quote'
] as const;
export type PrimeQualificationEvidence={gate:PrimeQualificationGate;
 status:'verified'|'not_applicable_by_authority'|'failed'|'unknown';
 evidenceRefs:string[];checkedAt?:string;expiresAt?:string};
export function assessPrimeQualification(input:{
 opportunityId:string;providerName:string;priorRole:'historical_bidder'|'historical_awardee'|'potential_supplier';
 evidence:PrimeQualificationEvidence[];asOf:string
}){
 if(!input.opportunityId.trim()||!input.providerName.trim()||!Number.isFinite(Date.parse(input.asOf)))
  throw Error('Canonical opportunity, legal provider identity and valid observation time required');
 const seen=new Set<PrimeQualificationGate>(),blockers:string[]=[];
 for(const e of input.evidence){
  if(!PRIME_QUALIFICATION_GATES.includes(e.gate)||seen.has(e.gate))throw Error('Unrecognized or duplicate qualification gate');
  seen.add(e.gate);
 }
 for(const gate of PRIME_QUALIFICATION_GATES){
  const e=input.evidence.find(x=>x.gate===gate);
  if(!e||e.status==='unknown')blockers.push(gate+':missing');
  else if(e.status==='failed')blockers.push(gate+':failed');
  else if(e.evidenceRefs.length===0)blockers.push(gate+':source_missing');
  else if(e.expiresAt&&Date.parse(e.expiresAt)<=Date.parse(input.asOf))blockers.push(gate+':expired');
 }
 return {opportunityId:input.opportunityId,providerName:input.providerName,
  priorRole:input.priorRole,verifiedRequirements:PRIME_QUALIFICATION_GATES.length-blockers.length,
  requiredRequirements:PRIME_QUALIFICATION_GATES.length,blockers,
  historicalBidIsNotAward:input.priorRole==='historical_bidder',
  readyForHumanReview:blockers.length===0,qualifiedToBid:false,
  teamContactAuthorized:false,partnerEngagementAuthorized:false,
  proposalAuthorized:false,signingAuthorized:false}
}

export type CostCategory=
 'direct_labor'|'subcontracted_work'|'materials_and_equipment'|'delivery_and_freight'|
 'tax_permits_and_fees'|'insurance_premium'|'performance_bond_premium'|
 'payment_bond_premium'|'other_bidding_fees'|'overhead'|'contingency'|
 'warranty_and_service'|'working_capital_financing';
export const COST_CATEGORIES:readonly CostCategory[]=[
 'direct_labor','subcontracted_work','materials_and_equipment','delivery_and_freight',
 'tax_permits_and_fees','insurance_premium','performance_bond_premium',
 'payment_bond_premium','other_bidding_fees','overhead','contingency',
 'warranty_and_service','working_capital_financing'
] as const;
export type CostLine={category:CostCategory;amountUsd:number|null;
 provenance:'written_quote'|'official_fee'|'payroll_schedule'|'verified_budget'|'missing';
 evidenceRefs:string[];validUntil?:string};
export function assessBidEconomics(input:{
 opportunityId:string;asOf:string;proposedBidPriceUsd:number|null;
 bidPriceEvidenceRefs:string[];costLines:CostLine[];
 requirements:{bidSecurityFraction:number|null;performanceBondCoverageFraction:number|null;
  paymentBondCoverageFraction:number|null;retainageFraction:number|null};
 fullScopeAndAmendmentsVerified:boolean;writtenPrimeAndSupplierQuotesVerified:boolean;
 ownerCashBridgeUsd:number|null;cashBridgeEvidenceRefs:string[];
}){
 if(!input.opportunityId.trim()||!Number.isFinite(Date.parse(input.asOf)))throw Error('Valid canonical bid identifier and observation time required');
 const blockers:string[]=[];
 const seen=new Set<CostCategory>();
 let sum=0;
 for(const line of input.costLines){
  if(!COST_CATEGORIES.includes(line.category)||seen.has(line.category))
   throw Error('Invalid or duplicate budget category');
  seen.add(line.category);
  if(line.amountUsd!==null&&(!Number.isFinite(line.amountUsd)||line.amountUsd<0))
   throw Error('Negative/invalid quote amounts may not produce profit');
  if(line.amountUsd!==null)sum+=line.amountUsd;
 }
 for(const category of COST_CATEGORIES){
  const line=input.costLines.find(l=>l.category===category);
  if(!line||line.amountUsd===null||line.provenance==='missing'||line.evidenceRefs.length===0||
   (line.validUntil!==undefined&&Date.parse(line.validUntil)<=Date.parse(input.asOf)))
   blockers.push('unpriced_or_unverified:'+category);
 }
 if(input.proposedBidPriceUsd===null||!Number.isFinite(input.proposedBidPriceUsd)||input.proposedBidPriceUsd<=0||
  input.bidPriceEvidenceRefs.length===0)blockers.push('proposed_bid_price_not_source_backed');
 if(!input.fullScopeAndAmendmentsVerified)blockers.push('complete_scope_and_amendments_missing');
 if(!input.writtenPrimeAndSupplierQuotesVerified)blockers.push('scope_specific_firm_supplier_quotes_missing');
 if(input.ownerCashBridgeUsd===null||!Number.isFinite(input.ownerCashBridgeUsd)||input.ownerCashBridgeUsd<0||
  input.cashBridgeEvidenceRefs.length===0)blockers.push('cash_bridge_not_proven');
 const r=input.requirements;
 for(const [name,fraction] of Object.entries(r)){
  if(fraction===null||!Number.isFinite(fraction)||fraction<0||fraction>1)blockers.push('unverified_contract_term:'+name);
 }
 const complete=blockers.length===0;
 const price=input.proposedBidPriceUsd;
 // Bond FACE COVERAGE is not a paid premium or cash deposit. Retainage is
 // delayed receivable, not an expense or reduction in contract face value.
 return {opportunityId:input.opportunityId,pricedCategories:input.costLines.filter(l=>l.amountUsd!==null&&l.evidenceRefs.length>0).length,
  requiredCostCategories:COST_CATEGORIES.length,complete,blockers,
  costTotalUsd:complete?Math.round(sum*100)/100:null,
  projectedGrossContributionUsd:complete&&price!==null?Math.round((price-sum)*100)/100:null,
  marginFraction:complete&&price!==null?Math.round((price-sum)/price*10000)/10000:null,
  bidSecurityFaceAmountUsd:price!==null&&r.bidSecurityFraction!==null&&Number.isFinite(price)&&price>0?Math.round(price*r.bidSecurityFraction*100)/100:null,
  performanceBondFaceAmountUsd:price!==null&&r.performanceBondCoverageFraction!==null&&Number.isFinite(price)&&price>0?Math.round(price*r.performanceBondCoverageFraction*100)/100:null,
  paymentBondFaceAmountUsd:price!==null&&r.paymentBondCoverageFraction!==null&&Number.isFinite(price)&&price>0?Math.round(price*r.paymentBondCoverageFraction*100)/100:null,
  retainageWithheldAtFullValueUsd:price!==null&&r.retainageFraction!==null&&Number.isFinite(price)&&price>0?Math.round(price*r.retainageFraction*100)/100:null,
  bondFacesAreNotCashPremiums:true,retainageIsDelayedCashNotCost:true,
  dealAuthorized:false,proposalsSendable:false,spendingAuthorized:false,pricingIsNotAnApproval:true};
}
