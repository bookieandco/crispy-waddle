import type { ProviderDiscoveryObservation } from './provider-discovery.js'

export type CompanyResearchSource='company_research'|'similar_company'|'entity_verification'
export type CompanyResearchReference={
  id:string
  locator:string
  revision?:string
  license?:string
  use:'architecture_reference'|'implementation_patterns'|'external_provider'
  executionAuthority:false
}
export const PROVIDER_COMPANY_RESEARCH_REFERENCES:readonly CompanyResearchReference[]=[
  {id:'exa-company-researcher',locator:'https://github.com/exa-labs/company-researcher',license:'MIT',use:'implementation_patterns',executionAuthority:false},
  {id:'blaxel-similar-company-finder',locator:'https://github.com/blaxel-templates/template-similar-company-finder',license:'MIT',use:'architecture_reference',executionAuthority:false},
  {id:'entitycheck',locator:'https://entitycheck.com/',use:'external_provider',executionAuthority:false},
]
export type CompanyResearchObservation={
  source:CompanyResearchSource
  providerName:string
  website?:string
  observedAt:string
  evidenceRef:string
  evidenceUrl?:string
  uei?:string
  cage?:string
  naicsCodes?:string[]
  pscCodes?:string[]
  capabilities?:string[]
  geography?:string
  legalStatus?:string
  registrationJurisdiction?:string
  sanctionsScreened?:boolean
  pepScreened?:boolean
  ownershipObserved?:boolean
  similarToProviderId?:string
  similarityEvidence?:string[]
}
export type CompanyResearchAdapter={
  id:string
  source:CompanyResearchSource
  research(input:{providerName?:string;website?:string;keywords:string[];naicsCodes:string[];geography?:string;limit:number}):Promise<CompanyResearchObservation[]>
}
export type CompanyResearchResult={
  observations:readonly CompanyResearchObservation[]
  discoveryObservations:readonly ProviderDiscoveryObservation[]
  warnings:readonly string[]
  authority:'RESEARCH_ONLY'
  engagementAuthorized:false
}
const uniq=(xs:string[])=>[...new Set(xs.map(x=>x.trim()).filter(Boolean))]
export function toDiscoveryObservation(x:CompanyResearchObservation):ProviderDiscoveryObservation{
  if(!x.providerName.trim()||!x.evidenceRef.trim())throw new Error('COMPANY_RESEARCH_EVIDENCE_REQUIRED')
  return{
    source:'entity_directory',sourceId:`${x.source}:${x.providerName}`,observedAt:x.observedAt,legalName:x.providerName,website:x.website,uei:x.uei,cage:x.cage,
    capabilities:(x.capabilities??[]).map(name=>({name,naicsCodes:uniq(x.naicsCodes??[]),pscCodes:uniq(x.pscCodes??[])})),
    serviceArea:x.geography?{country:x.geography}:undefined,evidenceRef:x.evidenceRef,evidenceUrl:x.evidenceUrl,
  }
}
export async function researchProviderCompanies(adapters:readonly CompanyResearchAdapter[],input:{providerName?:string;website?:string;keywords:string[];naicsCodes:string[];geography?:string;limit?:number}):Promise<CompanyResearchResult>{
  const observations:CompanyResearchObservation[]=[];const warnings:string[]=[]
  for(const adapter of adapters){try{observations.push(...await adapter.research({...input,limit:Math.max(1,Math.min(input.limit??25,100))}))}catch(e){warnings.push(`${adapter.id}: ${e instanceof Error?e.message:'company research failed'}`)}}
  return{observations,discoveryObservations:observations.map(toDiscoveryObservation),warnings:uniq(warnings),authority:'RESEARCH_ONLY',engagementAuthorized:false}
}
export function entityDueDiligenceComplete(x:CompanyResearchObservation):boolean{
  return x.source==='entity_verification'&&Boolean(x.legalStatus&&x.registrationJurisdiction&&x.sanctionsScreened!==undefined&&x.pepScreened!==undefined&&x.evidenceRef)
}
export function similarCompanySeedEligible(x:CompanyResearchObservation):boolean{
  return Boolean(x.website&&x.capabilities?.length&&x.evidenceRef)&&x.source!=='similar_company'
}
