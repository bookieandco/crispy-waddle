/** SHARK-ALPHA.FABRIC.13 — source permission and canary evidence gates.
 * A local receipt cannot self-certify provider authorization, terms, live collection,
 * spend approval or owner device verification. No network or secret access here.
 */
export type AlphaFeedSource='PUMP'|'BLUESKY'|'X'|'REDDIT'
export type AlphaFeedPolicy=Readonly<{
 source:AlphaFeedSource
 ownerOptIn:boolean
 accessReviewed:boolean
 approvedReadScope:'PUBLIC_APPVIEW'|'APPROVED_READ_ONLY'|'SOLANA_PROGRAM_LOGS'|'NONE'
 reviewEvidenceId?:string
 reviewedAt?:string
 budget:'FREE_ONLY'|'OWNER_APPROVED_METERED'|'UNAPPROVED'
 maxCallsPerMinute:number
}>
export type AlphaFeedCanary=Readonly<{
 source:AlphaFeedSource
 requestedAt:string
 receivedAt:string
 result:'BOUNDED_VALID_RESPONSE'|'REJECTED'|'UNAVAILABLE'
 evidenceId:string
 responseDigest?:string
 sourceProof:'PROVIDER_UNATTESTED'
}>
export type AlphaFeedCommissionGate=Readonly<{
 source:AlphaFeedSource
 status:'POLICY_BLOCKED'|'CANARY_REQUIRED'|'CANARY_REJECTED'|'CANARY_PASSED_SOURCE_ONLY'
 blockingReasons:readonly string[]
 freshnessSeconds?:number
 scope:'RESEARCH_READ_ONLY'
 liveDeliveryVerified:false
 productionCommissioned:false
 budgetCharged:false
 canTrade:false
}>
const validIso=(s:string):boolean=>typeof s==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(s)&&Number.isFinite(Date.parse(s))
const id=(s:string|undefined):boolean=>typeof s==='string'&&/^[a-zA-Z0-9:_./-]{6,160}$/.test(s)
export function evaluateAlphaFeedCommission(input:Readonly<{
 policy:AlphaFeedPolicy
 canary?:AlphaFeedCanary
 asOf:string
}>):AlphaFeedCommissionGate{
 const {policy:p,canary:c}=input
 if(!['PUMP','BLUESKY','X','REDDIT'].includes(p.source)||!validIso(input.asOf)||
    !Number.isInteger(p.maxCallsPerMinute)||p.maxCallsPerMinute<1||p.maxCallsPerMinute>120)
   throw new Error('alpha_feed_policy_invalid')
 const blocks:string[]=[]
 if(!p.ownerOptIn)blocks.push('owner-opt-in-required')
 if(!p.accessReviewed||!id(p.reviewEvidenceId)||!p.reviewedAt||!validIso(p.reviewedAt)||
    Date.parse(p.reviewedAt)>Date.parse(input.asOf))blocks.push('reviewed-access-evidence-required')
 if(p.budget==='UNAPPROVED')blocks.push('budget-not-approved')
 if(p.budget==='OWNER_APPROVED_METERED')blocks.push('metered-billing-remains-uncommissioned')
 const required=p.source==='PUMP'?'SOLANA_PROGRAM_LOGS':p.source==='BLUESKY'?'PUBLIC_APPVIEW':'APPROVED_READ_ONLY'
 if(p.approvedReadScope!==required)blocks.push('provider-specific-scope-required')
 let status:AlphaFeedCommissionGate['status']='POLICY_BLOCKED'
 let freshnessSeconds:number|undefined
 if(!blocks.length){
   status='CANARY_REQUIRED'
   if(c){
     if(c.source!==p.source||!id(c.evidenceId)||!validIso(c.requestedAt)||!validIso(c.receivedAt)||
       Date.parse(c.receivedAt)<Date.parse(c.requestedAt)||
       Date.parse(c.receivedAt)>Date.parse(input.asOf)||
       c.sourceProof!=='PROVIDER_UNATTESTED')throw new Error('alpha_feed_canary_invalid')
     freshnessSeconds=Math.floor((Date.parse(input.asOf)-Date.parse(c.receivedAt))/1000)
     if(c.result==='BOUNDED_VALID_RESPONSE'&&
        typeof c.responseDigest==='string'&&/^[a-f0-9]{64}$/.test(c.responseDigest)&&
        freshnessSeconds<=300)status='CANARY_PASSED_SOURCE_ONLY'
     else status='CANARY_REJECTED'
   }
 }
 return Object.freeze({
  source:p.source,status,blockingReasons:Object.freeze(blocks),
  freshnessSeconds,scope:'RESEARCH_READ_ONLY' as const,
  liveDeliveryVerified:false as const,productionCommissioned:false as const,
  budgetCharged:false as const,canTrade:false as const,
 })
}
/** Deliberately no commission() or write/execute function. A source-only canary is
 * not a deploy, source authenticity receipt, owner private-device pass or license grant.
 */
