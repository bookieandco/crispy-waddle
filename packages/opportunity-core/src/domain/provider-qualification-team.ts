import type { FulfillmentProvider } from './fulfillment-provider.js'
import type { OpportunityRequirementSet } from './opportunity-requirement.js'
import { buildFulfillmentPlan, buildProviderShortlist, type FulfillmentPlan } from './fulfillment-plan.js'
import { rankFulfillmentProviders, type FulfillmentProviderMatch } from './provider-matching.js'

export type ProviderQualification={
 providerId:string
 status:'qualified'|'review_required'|'blocked'
 evidenceRefs:string[]
 blockers:string[]
 score:number
}

export function qualifyProviders(set:OpportunityRequirementSet,providers:FulfillmentProvider[],now=new Date().toISOString()):ProviderQualification[]{
 const t=Date.parse(now)
 return rankFulfillmentProviders(set,providers).map(match=>{
  const provider=providers.find(p=>p.id===match.providerId)!
  const blockers=[...match.blockers]
  for(const credential of provider.credentials.filter(c=>c.verified&&c.expiresAt&&Date.parse(c.expiresAt)<=t))blockers.push(`Expired credential: ${credential.name}`)
  if(provider.capacity.status==='unknown')blockers.push('Provider capacity is not verified.')
  if(provider.capacity.status==='unavailable')blockers.push('Provider capacity is unavailable.')
  const status=match.disposition==='blocked'||blockers.some(x=>/expired|unavailable/i.test(x))?'blocked':blockers.length?'review_required':'qualified'
  return {providerId:provider.id,status,evidenceRefs:match.evidenceRefs,blockers:[...new Set(blockers)],score:match.score}
 })
}

export type TeamCandidate={plan:FulfillmentPlan;shortlist:FulfillmentProviderMatch[];qualification:ProviderQualification[];humanApprovalRequired:true;engagementAuthorized:false}

export function buildPrimeSubTeam(set:OpportunityRequirementSet,providers:FulfillmentProvider[],now?:string):TeamCandidate{
 const qualification=qualifyProviders(set,providers,now)
 const eligible=new Set(qualification.filter(q=>q.status!=='blocked').map(q=>q.providerId))
 const pool=providers.filter(p=>eligible.has(p.id))
 return {plan:buildFulfillmentPlan(set,pool),shortlist:buildProviderShortlist(set,pool,10),qualification,humanApprovalRequired:true,engagementAuthorized:false}
}
