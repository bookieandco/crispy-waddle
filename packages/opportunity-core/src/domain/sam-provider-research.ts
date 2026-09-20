import type { OpportunityRequirementSet } from './opportunity-requirement.js'
import { discoverFulfillmentProviders, type ProviderDiscoveryAdapter, type ProviderDiscoveryResult } from './provider-discovery.js'
import { evaluateProviderFreshness, type ProviderFreshnessResult } from './provider-freshness.js'
import { providerToIdentityCandidate, resolveProviderIdentity, type ProviderIdentityResolution } from './provider-identity-awards.js'
import type { FulfillmentProvider } from './fulfillment-provider.js'

export type SamProviderResearchResult = {
  opportunityId:string
  discovery:ProviderDiscoveryResult
  identities:Record<string,ProviderIdentityResolution>
  freshness:ProviderFreshnessResult[]
  researchStatus:'complete'|'needs_evidence'|'no_candidates'
  blockers:string[]
  outreachAuthorized:false
  bidSubmissionAuthorized:false
}

const uniq=(v:string[])=>[...new Set(v.map(x=>x.trim()).filter(Boolean))]

export async function runSamProviderResearch(input:{
  requirements:OpportunityRequirementSet
  adapters:ProviderDiscoveryAdapter[]
  knownProviders?:FulfillmentProvider[]
  now?:string
  limit?:number
}):Promise<SamProviderResearchResult>{
  const now=input.now??new Date().toISOString()
  const requirements=input.requirements.requirements
  const discovery=await discoverFulfillmentProviders(input.adapters,{
    keywords:uniq(requirements.flatMap(r=>r.tokens)),
    naicsCodes:uniq(requirements.filter(r=>r.kind==='naics').flatMap(r=>r.tokens)),
    pscCodes:uniq(requirements.filter(r=>r.kind==='psc').flatMap(r=>r.tokens)),
    geography:requirements.find(r=>r.kind==='geography')?.summary,
    limit:input.limit??25,
  },now)
  const candidates=(input.knownProviders??[]).map(providerToIdentityCandidate)
  const identities:Record<string,ProviderIdentityResolution>={}
  const blockers:string[]=[]
  for(const provider of discovery.providers){
    const uei=provider.identifiers.find(x=>x.type==='uei')?.value
    const cage=provider.identifiers.find(x=>x.type==='cage')?.value
    const resolution=resolveProviderIdentity({legalName:provider.legalName,uei,cage},candidates)
    identities[provider.id]=resolution
    if(resolution.status!=='matched')blockers.push(`${provider.legalName}: identity ${resolution.status}`)
  }
  const freshness=discovery.providers.map(provider=>evaluateProviderFreshness(provider,now))
  for(const item of freshness.filter(x=>x.status!=='fresh'))blockers.push(...item.issues.filter(x=>x.blocking).map(x=>`${item.providerId}: ${x.message}`))
  return {
    opportunityId:input.requirements.opportunityId,discovery,identities,freshness,
    researchStatus:!discovery.providers.length?'no_candidates':blockers.length?'needs_evidence':'complete',
    blockers:uniq(blockers),outreachAuthorized:false,bidSubmissionAuthorized:false,
  }
}
