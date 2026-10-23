/**
 * Source-verified working-capital bridge. Borrowing, drawdowns and payments
 * remain forbidden; this is a no-send research estimate, never funding consent.
 */
export type VerifiedCashFlowPeriod={
 period:string;customerReceiptsUsd:number;outgoingPaymentsUsd:number;
 unpaidRetainageUsd:number;evidenceRefs:string[];
}
export type CashBridgeAssessment={
 knownSchedule:boolean;peakUnfundedCashNeedUsd:number|null;
 verifiedAvailableCashUsd:number|null;additionalCashRequiredUsd:number|null;
 unpaidRetainageUsd:number|null;fundsCoverModeledPeak:boolean;
 blockers:string[];noSpend:true;noLoanAuthorized:true;noBidAuthorized:true;
}
const usd=(n:number)=>Math.round(n*100)/100
const validCash=(n:number)=>Number.isFinite(n)&&n>=0&&usd(n)===n
export function assessPublicContractCashBridge(input:{
 opportunityId:string;periods:VerifiedCashFlowPeriod[];
 verifiedUnrestrictedFundsUsd:number|null;fundingEvidenceRefs:string[];
 drawScheduleComplete:boolean;paymentTermsVerified:boolean;
 retentionReleaseDateVerified:boolean
}):CashBridgeAssessment{
 if(!input.opportunityId.trim())throw Error('Canonical buyer opportunity ID required')
 const blockers:string[]=[]
 if(!input.drawScheduleComplete)blockers.push('all_project_cash_periods_not_verified')
 if(!input.paymentTermsVerified)blockers.push('buyer_payment_terms_unverified')
 if(!input.retentionReleaseDateVerified)blockers.push('retention_release_date_unverified')
 if(!input.periods.length)blockers.push('no_invoice_payment_cash_schedule')
 let minCumulative=0,cumulative=0,retainage=0
 let last=''
 for(const row of input.periods){
  if(!/^\d{4}-\d{2}(?:-\d{2})?$/.test(row.period)||row.period<=last)
   throw Error('Cash bridge periods require unique ascending YYYY-MM or YYYY-MM-DD')
  last=row.period
  if(!validCash(row.customerReceiptsUsd)||!validCash(row.outgoingPaymentsUsd)||!validCash(row.unpaidRetainageUsd))
   throw Error('Cash receipts, expenses and withheld retainage require nonnegative cents')
  if(!row.evidenceRefs.length)blockers.push('cash_period_source_missing:'+row.period)
  cumulative=usd(cumulative+row.customerReceiptsUsd-row.outgoingPaymentsUsd)
  minCumulative=Math.min(minCumulative,cumulative)
  retainage=usd(retainage+row.unpaidRetainageUsd)
 }
 const funds=input.verifiedUnrestrictedFundsUsd
 if(funds===null||!validCash(funds)||input.fundingEvidenceRefs.length===0)
  blockers.push('unrestricted_cash_balance_not_verified')
 const knownSchedule=blockers.length===0
 const peak=knownSchedule?usd(-minCumulative):null
 const need=peak!==null&&funds!==null?usd(Math.max(0,peak-funds)):null
 return {knownSchedule,peakUnfundedCashNeedUsd:peak,
  verifiedAvailableCashUsd:funds!==null&&validCash(funds)&&input.fundingEvidenceRefs.length>0?funds:null,
  additionalCashRequiredUsd:knownSchedule?need:null,
  unpaidRetainageUsd:knownSchedule?retainage:null,
  fundsCoverModeledPeak:knownSchedule&&need===0,
  blockers,noSpend:true,noLoanAuthorized:true,noBidAuthorized:true}
}

/** Classify procurement routes without imposing construction-only law on goods. */
export type PurchaseKind='public_works_construction'|'goods_and_equipment'|
 'professional_or_operating_services'|'goods_with_possible_installation'|'unknown'
export type PrimeChannel='licensed_general_prime'|'licensed_trade_sub'|
 'authorized_dealer_or_distributor'|'direct_manufacturer'|'local_prime_teaming'|
 'cooperative_vehicle'|'service_provider'
export type BuyerStructureEvidence={
 opportunityId:string;kind:PurchaseKind;kindDeterminationOfficial:boolean;
 bidderRegistrationVerified:boolean;fullBuyerTermsRead:boolean;
 bidderRoleApprovedInTerms:boolean;subcontractingOrResaleRulesVerified:boolean;
 currentLicensesVerified:boolean;currentDirRegistrationVerified:boolean;
 installationAndPrevailingWageClassificationVerified:boolean;
 partnerOrManufacturerAuthorizationVerified:boolean;
 writtenQuotesComplete:boolean;evidenceRefs:string[];
}
export function assessRegionalPrimeChannel(input:{
 opportunity:BuyerStructureEvidence;role:PrimeChannel
}){
 const o=input.opportunity
 if(!o.opportunityId.trim())throw Error('Canonical procurement ID required')
 const blockers:string[]=[]
 if(!o.evidenceRefs.length)blockers.push('official_buyer_terms_not_source_attributed')
 if(!o.kindDeterminationOfficial||o.kind==='unknown')blockers.push('official_purchase_classification_unverified')
 if(!o.fullBuyerTermsRead)blockers.push('full_official_procurement_terms_missing')
 if(!o.bidderRegistrationVerified)blockers.push('bidder_registration_not_verified')
 if(!o.bidderRoleApprovedInTerms)blockers.push('specific_bidder_structure_not_approved')
 if(!o.subcontractingOrResaleRulesVerified)blockers.push('teaming_resale_and_subcontract_clauses_missing')
 if(!o.writtenQuotesComplete)blockers.push('scope_specific_firm_quote_missing')
 const isConstruction=o.kind==='public_works_construction'
 const mayInstall=o.kind==='goods_with_possible_installation'||o.kind==='unknown'
 const isTradeRole=input.role==='licensed_general_prime'||input.role==='licensed_trade_sub'
 if(isConstruction){
  if(!o.currentLicensesVerified)blockers.push('scope_specific_active_trade_license_missing')
  if(!o.currentDirRegistrationVerified)blockers.push('current_dir_public_works_registration_missing')
  if(!o.installationAndPrevailingWageClassificationVerified)blockers.push('public_works_wage_and_labor_classification_missing')
 }
 if(mayInstall&&!o.installationAndPrevailingWageClassificationVerified)
  blockers.push('installation_may_trigger_public_works_obligations')
 if(isTradeRole&&!o.currentLicensesVerified)blockers.push('construction_prime_license_not_proven')
 if((input.role==='authorized_dealer_or_distributor'||input.role==='local_prime_teaming')&&
   !o.partnerOrManufacturerAuthorizationVerified)
  blockers.push('manufacturer_or_prime_consent_missing')
 if(input.role==='cooperative_vehicle'&&!o.bidderRoleApprovedInTerms)
  blockers.push('cooperative_purchasing_vehicle_not_buyer_authorized')
 return {opportunityId:o.opportunityId,kind:o.kind,role:input.role,
  reviewedForHumanDecision:blockers.length===0,blockers:[...new Set(blockers)],
  treatedAsPublicWorks:isConstruction,
  constructionLawExemptionClaimed:false,
  noSupplierContactAuthorized:true,noRegistrationAuthorized:true,
  noBidAuthorized:true,noSigningAuthorized:true,noSpendingAuthorized:true}
}
