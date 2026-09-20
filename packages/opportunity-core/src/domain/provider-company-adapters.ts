import { researchProviderCompanies, type CompanyResearchAdapter, type CompanyResearchObservation } from './provider-company-research.js'

export interface ExaSearchClient{searchAndContents(input:{query:string;numResults:number;includeDomains?:string[]}):Promise<Array<{id:string;url:string;title?:string;text?:string}>>}
const domainsFrom=(website?:string)=>{if(!website)return undefined;try{return[new URL(website).hostname]}catch{return undefined}}
const iso=()=>new Date().toISOString()
export function createExaCompanyResearchAdapter(client:ExaSearchClient):CompanyResearchAdapter{
  return{id:'exa-company-research',source:'company_research',async research(input){
    const query=[input.providerName,input.website,...input.keywords,...input.naicsCodes,input.geography,'company capabilities government contractor'].filter(Boolean).join(' ')
    const rows=await client.searchAndContents({query,numResults:input.limit,includeDomains:domainsFrom(input.website)})
    return rows.map((r,i):CompanyResearchObservation=>({source:'company_research',providerName:input.providerName||r.title||new URL(r.url).hostname,website:input.website||r.url,observedAt:iso(),evidenceRef:`exa:${r.id||i+1}`,evidenceUrl:r.url,naicsCodes:input.naicsCodes,capabilities:input.keywords,geography:input.geography}))
  }}
}
export function createSimilarCompanyAdapter(client:ExaSearchClient,seed:{providerId:string;providerName:string;website:string;capabilities:string[]}):CompanyResearchAdapter{
  return{id:'exa-similar-company',source:'similar_company',async research(input){
    const rows=await client.searchAndContents({query:`companies similar to ${seed.providerName} ${seed.capabilities.join(' ')} ${input.geography??''}`,numResults:input.limit})
    return rows.filter(r=>r.url!==seed.website).map((r,i):CompanyResearchObservation=>({source:'similar_company',providerName:r.title||new URL(r.url).hostname,website:r.url,observedAt:iso(),evidenceRef:`exa:similar:${r.id||i+1}`,evidenceUrl:r.url,naicsCodes:input.naicsCodes,capabilities:input.keywords,geography:input.geography,similarToProviderId:seed.providerId,similarityEvidence:[`seed:${seed.providerId}`]}))
  }}
}
export interface EntityVerificationClient{verify(input:{legalName:string;website?:string}):Promise<{id:string;url?:string;legalStatus?:string;registrationJurisdiction?:string;sanctionsScreened?:boolean;pepScreened?:boolean;ownershipObserved?:boolean}>}
export function createEntityVerificationAdapter(client:EntityVerificationClient):CompanyResearchAdapter{
  return{id:'entity-verification',source:'entity_verification',async research(input){
    if(!input.providerName)throw new Error('ENTITY_VERIFICATION_PROVIDER_NAME_REQUIRED')
    const r=await client.verify({legalName:input.providerName,website:input.website})
    return[{source:'entity_verification',providerName:input.providerName,website:input.website,observedAt:iso(),evidenceRef:`entity:${r.id}`,evidenceUrl:r.url,legalStatus:r.legalStatus,registrationJurisdiction:r.registrationJurisdiction,sanctionsScreened:r.sanctionsScreened,pepScreened:r.pepScreened,ownershipObserved:r.ownershipObserved}]
  }}
}
export async function enrichProviderDiscovery(input:{adapters:readonly CompanyResearchAdapter[];providerName?:string;website?:string;keywords:string[];naicsCodes:string[];geography?:string;limit?:number}){return researchProviderCompanies(input.adapters,input)}
