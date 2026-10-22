/**
 * Nationwide procurement: regional prime and fulfillment research.
 *
 * Observed awards are historical facts; no observed award implies a supplier
 * has agreed to partner, may lawfully prime a future RFQ, or can fulfil it.
 * Reuse the canonical PublicAwardPrimeFingerprint and FulfillmentPlan gates.
 */
import type {PublicAwardPrimeFingerprint} from './public-award-prime.js'

export type ProcurementPrimeRole=
  | 'direct_prime'|'regional_prime_teaming'|'subcontract_to_awarded_prime'
  | 'specialty_subcontractor'|'authorized_reseller'|'cooperative_contract'
export type PrimeRegionalEvidence={
  providerId:string
  companyName:string
  stateAwards:string[]
  countyServiceAreas:string[]
  officialAwardRefs:string[]
  naicsCodes:string[]
  capabilityKeywords:string[]
  awardCount:number
  observedAt?:string
  capacity:'available'|'limited'|'unknown'|'unavailable'
  licensing:'verified_for_scope'|'unknown'|'expired'|'not_required_verified'
  bonding:'verified_for_scope'|'unknown'|'not_required_verified'
  insurance:'verified_for_scope'|'unknown'|'not_required_verified'
  businessRegistration:'verified'|'unknown'
  partnerConsent:'accepted_for_this_scope'|'not_requested'|'declined'
  quote:'firm_current'|'estimate'|'missing'
  sourceKind:'local_award'|'sam_award'|'supplier_profile'
}
export type PrimeRegionalOpportunity={
  opportunityId:string
  buyer:string
  state:string
  county?:string
  capabilityKeywords:string[]
  naicsCodes:string[]
  sourceEvidenceRefs:string[]
  officialSolicitationComplete:boolean
  addendaVerified:boolean
  requiredTradeLicenses:string[]
  bondingRequired:'yes'|'no'|'unknown'
  allowedPrimeStructure:'verified'|'unknown'|'prohibited'
  deadlineAt?:string
  directBidEligible:'verified'|'unknown'|'prohibited'
  subcontractingAllowed:'verified'|'unknown'|'prohibited'
}
export type RegionalPrimeCandidate={
  providerId:string
  providerName:string
  role:ProcurementPrimeRole
  score:number
  disposition:'research_candidate'|'review_required'|'blocked'
  matchingSignals:string[]
  blockers:string[]
  evidenceRefs:string[]
  pastAwardNotCurrentCapacity:true
  teamingAgreementRequired:true
  outBoundContactAuthorized:false
  bidSubmissionAuthorized:false
  signingAuthorized:false
  spendingAuthorized:false
}
export type RegionalPrimeMatrix={
  opportunityId:string
  evidenceComplete:boolean
  results:RegionalPrimeCandidate[]
  noSend:true
  supplierQuotesVerified:false
  biddingAuthorized:false
}
const uniq=(arr:string[])=>[...new Set(arr.map(s=>s.trim()).filter(Boolean))]
const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
const words=(arr:string[])=>uniq(arr.flatMap(s=>norm(s).split(' ')).filter(s=>s.length>=4))
const capped=(n:number)=>Math.max(0,Math.min(100,Math.round(n)))
function overlap(a:string[],b:string[]):number{
 const aa=words(a),bb=new Set(words(b))
 return aa.length?aa.filter(x=>bb.has(x)).length/aa.length:0
}
export function regionalPrimeEvidenceFromAwards(prime:PublicAwardPrimeFingerprint,sourceKind:'local_award'|'sam_award'='local_award'):PrimeRegionalEvidence{
 return {providerId:prime.providerId,companyName:prime.providerName,stateAwards:prime.states,
  countyServiceAreas:[],officialAwardRefs:prime.evidenceRefs,naicsCodes:prime.naicsCodes,
  capabilityKeywords:prime.capabilityKeywords,awardCount:prime.awardCount,sourceKind,
  capacity:'unknown',licensing:'unknown',bonding:'unknown',insurance:'unknown',businessRegistration:'unknown',
  partnerConsent:'not_requested',quote:'missing'}
}
export function buildRegionalPrimeMatrix(input:{
 opportunity:PrimeRegionalOpportunity
 providers:PrimeRegionalEvidence[]
 roles?:ProcurementPrimeRole[]
 now?:string
 maxCandidates?:number
}):RegionalPrimeMatrix{
 const o=input.opportunity
 if(!o.opportunityId.trim()||!/^[A-Z]{2}$/.test(o.state))throw Error('A canonical opportunity and state are required')
 if(!Number.isInteger(input.maxCandidates??30)||(input.maxCandidates??30)<1||(input.maxCandidates??30)>50)
  throw Error('Prime shortlist limit out of bounds')
 const roles=input.roles??['direct_prime','regional_prime_teaming','subcontract_to_awarded_prime',
  'specialty_subcontractor','authorized_reseller','cooperative_contract']
 const allowedRoles=new Set<ProcurementPrimeRole>([
  'direct_prime','regional_prime_teaming','subcontract_to_awarded_prime',
  'specialty_subcontractor','authorized_reseller','cooperative_contract'])
 if(roles.some(role=>!allowedRoles.has(role)))throw Error('Unknown contracting structure')
 const now=input.now??new Date().toISOString()
 const out:RegionalPrimeCandidate[]=[]
 for(const provider of input.providers){
  if(!provider.providerId.trim()||!provider.companyName.trim())continue
  for(const role of roles){
   const blockers:string[]=[]
   const signals:string[]=[]
   const evidenceRefs=uniq(provider.officialAwardRefs)
   const sameState=provider.stateAwards.includes(o.state)
   const county=o.county?.trim()
   const localEvidence=Boolean(county&&provider.countyServiceAreas.some(x=>norm(x)===norm(county)))
   const capability=overlap(o.capabilityKeywords,provider.capabilityKeywords)
   const naics=o.naicsCodes.length&&provider.naicsCodes.some(c=>o.naicsCodes.includes(c))
   const geo=localEvidence?30:sameState?16:0
   const categoryScore=naics?30:Math.round(capability*28)
   let score=capped(geo+categoryScore+Math.min(12,provider.awardCount*3)+(evidenceRefs.length?10:0))
   if(sameState)signals.push('Historical awarded work in requested state; not current local capacity.')
   if(localEvidence)signals.push('Explicit county service-area evidence claimed; verify its source.')
   if(naics)signals.push('Observed NAICS code overlaps requested industry.')
   if(capability>=0.5)signals.push('Documented award capability keywords overlap.')
   if(evidenceRefs.length)signals.push('Historical award or company evidence references attached.')
   if(!sameState&&!localEvidence){blockers.push('No local or statewide historical geography match.');score=Math.min(score,30)}
   if(!naics&&capability<0.25)blockers.push('Requested procurement scope not corroborated by NAICS or company capabilities.')
   if(!evidenceRefs.length)blockers.push('No source-attributed provider or award evidence.')
   if(provider.capacity!=='available')blockers.push('Provider current capacity not affirmatively verified.')
   if(provider.licensing==='expired')blockers.push('Provider license expired.')
   else if(provider.licensing==='unknown')blockers.push('Scope-specific license status unverified.')
   if(provider.bonding==='unknown'&&o.bondingRequired!=='no')blockers.push('Bonding requirement or qualification unverified.')
   if(provider.insurance==='unknown')blockers.push('Required liability/vehicle/workers compensation cover unverified.')
   if(provider.businessRegistration!=='verified')blockers.push('Required vendor and business registrations unverified.')
   if(provider.partnerConsent!=='accepted_for_this_scope')blockers.push('No current scope-specific partner/team consent.')
   if(provider.quote!=='firm_current')blockers.push('No current written all-in quote.')
   if(!o.officialSolicitationComplete)blockers.push('Official bid documents and scope not fully certified.')
   if(!o.addendaVerified)blockers.push('Latest official amendments not verified.')
   if(o.allowedPrimeStructure!=='verified')blockers.push('Prime-subcontract/intermediary arrangement not proven permissible.')
   if(o.deadlineAt&&Date.parse(o.deadlineAt)<=Date.parse(now))blockers.push('Official listed deadline has passed or is invalid.')
   if(role==='direct_prime'&&o.directBidEligible!=='verified')blockers.push('Direct bidder eligibility not verified.')
   if((role==='subcontract_to_awarded_prime'||role==='specialty_subcontractor')&&o.subcontractingAllowed!=='verified')
    blockers.push('Subcontracting and consent/flow-down requirements unverified.')
   if(role==='authorized_reseller')blockers.push('Brand, reseller appointment and buy-sell authorization must be proven.')
   if(role==='cooperative_contract')blockers.push('Purchasing authority, vehicle eligibility, and cooperative contract scope unverified.')
   if(role==='regional_prime_teaming')blockers.push('Prime teaming agreement, allocation of responsibility and approvals missing.')
   if(provider.partnerConsent==='declined')blockers.push('Provider declined participation.')
   if(provider.capacity==='unavailable')blockers.push('Provider reports no capacity.')
   const blocked=provider.capacity==='unavailable'||provider.partnerConsent==='declined'||
    provider.licensing==='expired'||o.allowedPrimeStructure==='prohibited'||
    (role==='direct_prime'&&o.directBidEligible==='prohibited')||
    ((role==='subcontract_to_awarded_prime'||role==='specialty_subcontractor')&&o.subcontractingAllowed==='prohibited')||
    !evidenceRefs.length
   const disposition=blocked?'blocked':'review_required'
   out.push({providerId:provider.providerId,providerName:provider.companyName,role,score,disposition,
    matchingSignals:signals,blockers:uniq(blockers),evidenceRefs,
    pastAwardNotCurrentCapacity:true,teamingAgreementRequired:true,outBoundContactAuthorized:false,
    bidSubmissionAuthorized:false,signingAuthorized:false,spendingAuthorized:false})
  }
 }
 const ranked=out.sort((a,b)=>b.score-a.score||a.providerName.localeCompare(b.providerName)||a.role.localeCompare(b.role))
 return {opportunityId:o.opportunityId,evidenceComplete:o.officialSolicitationComplete&&o.addendaVerified,
  results:ranked.slice(0,input.maxCandidates??30),noSend:true,supplierQuotesVerified:false,biddingAuthorized:false}
}
