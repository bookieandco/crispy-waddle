import type { FulfillmentProvider, FulfillmentProviderEvidence, FulfillmentProviderIdentifier, FulfillmentProviderPastPerformance } from './fulfillment-provider.js'
import type { ProviderAwardRecord } from './provider-identity-awards.js'

export type ProviderDiscoverySource = 'entity_directory' | 'award_history' | 'workforce' | 'local_business' | 'web_search' | 'manual'

export type ProviderDiscoveryObservation = {
  source: ProviderDiscoverySource
  sourceId: string
  observedAt: string
  legalName: string
  website?: string
  uei?: string
  cage?: string
  capabilities?: Array<{name:string;naicsCodes?:string[];pscCodes?:string[];keywords?:string[]}>
  serviceArea?: {country?:string;state?:string;county?:string;locality?:string}
  capacity?: {status:'unknown'|'available'|'limited'|'unavailable';workforceSize?:number;maxConcurrentProjects?:number}
  award?: ProviderAwardRecord
  evidenceRef: string
  evidenceUrl?: string
}

export type ProviderDiscoveryAdapter = {
  id: string
  source: ProviderDiscoverySource
  discover(input:{keywords:string[];naicsCodes:string[];pscCodes:string[];geography?:string;limit:number}):Promise<ProviderDiscoveryObservation[]>
}

export type ProviderDiscoveryResult = {
  providers: FulfillmentProvider[]
  awards: ProviderAwardRecord[]
  observations: ProviderDiscoveryObservation[]
  warnings: string[]
  authority: 'DISCOVERY_ONLY'
  engagementAuthorized: false
}

const uniq=(v:string[])=>[...new Set(v.map(x=>x.trim()).filter(Boolean))]
const key=(o:ProviderDiscoveryObservation)=>o.uei?.trim().toLowerCase()||o.cage?.trim().toLowerCase()||o.legalName.trim().toLowerCase().replace(/[^a-z0-9]/g,'')

export function observationsToFulfillmentProviders(observations:ProviderDiscoveryObservation[], now=new Date().toISOString()):ProviderDiscoveryResult{
  const groups=new Map<string,ProviderDiscoveryObservation[]>()
  for(const o of observations){
    if(!o.legalName.trim()||!o.evidenceRef.trim())continue
    const k=key(o),g=groups.get(k)??[];g.push(o);groups.set(k,g)
  }
  const providers:FulfillmentProvider[]=[]
  const awards:ProviderAwardRecord[]=[]
  const warnings:string[]=[]
  for(const [k,rows] of groups){
    const first=rows[0]
    const evidence:FulfillmentProviderEvidence[]=rows.flatMap((o)=>{
      const base={sourceId:o.sourceId,sourceUrl:o.evidenceUrl,capturedAt:o.observedAt,confidence:o.source==='entity_directory'||o.source==='award_history'?0.9:0.6}
      const out:FulfillmentProviderEvidence[]=[{...base,id:o.evidenceRef,kind:o.source==='award_history'?'award_record':o.source==='entity_directory'?'entity_record':o.source==='workforce'?'capacity_record':o.source==='manual'?'user_supplied':'secondary_source',relationship:o.source==='award_history'?'supports_past_performance':o.source==='workforce'?'supports_capacity':'supports_identity'}]
      for(let i=0;i<(o.capabilities??[]).length;i++)out.push({...base,id:`${o.evidenceRef}:cap:${i+1}`,kind:'capability_record',relationship:'supports_capability'})
      return out
    })
    const evidenceIds=uniq(evidence.map(e=>e.id))
    const identifiers:FulfillmentProviderIdentifier[]=[]
    const uei=rows.find(x=>x.uei)?.uei,cage=rows.find(x=>x.cage)?.cage
    if(uei)identifiers.push({type:'uei',value:uei,verified:false,evidenceRefs:evidenceIds})
    if(cage)identifiers.push({type:'cage',value:cage,verified:false,evidenceRefs:evidenceIds})
    const pastPerformance:FulfillmentProviderPastPerformance[]=rows.filter(x=>x.award).map((o,i)=>{
      const a=o.award!;awards.push(a)
      return {id:a.id,role:'prime',customer:a.agency??'unknown',agency:a.agency,awardId:a.id,amount:a.amount,currency:a.currency,startedAt:a.startAt,endedAt:a.endAt,capabilityIds:[],verified:false,evidenceRefs:[o.evidenceRef]}
    })
    let capIndex=0
    const caps=rows.flatMap(o=>(o.capabilities??[]).map((cap,i)=>({id:`${k}:cap:${++capIndex}`,name:cap.name,naicsCodes:uniq(cap.naicsCodes??[]),pscCodes:uniq(cap.pscCodes??[]),keywords:uniq(cap.keywords??[]),confidence:0.5,verified:false,evidenceRefs:[`${o.evidenceRef}:cap:${i+1}`]})))
    if(!uei&&!cage)warnings.push(`Provider ${first.legalName} requires identity resolution before verification.`)
    providers.push({
      id:`provider:discovered:${k}`,legalName:first.legalName.trim(),website:first.website,
      identifiers,serviceAreas:[],capabilities:caps,credentials:[],pastPerformance,
      capacity:(()=>{const row=rows.find(x=>x.capacity);return row?.capacity?{...row.capacity,evidenceRefs:[row.evidenceRef]}:{status:'unknown',evidenceRefs:[]}})(),
      evidence,sourceIds:uniq(rows.map(x=>x.sourceId)),verificationStatus:'unverified',stage:'discovered',
      riskFlags:['discovery-only: requires evidence relationship normalization before verification'],createdAt:now,updatedAt:now,
    })
  }
  return {providers,awards,observations,warnings:uniq(warnings),authority:'DISCOVERY_ONLY',engagementAuthorized:false}
}

export async function discoverFulfillmentProviders(adapters:ProviderDiscoveryAdapter[],input:{keywords:string[];naicsCodes:string[];pscCodes:string[];geography?:string;limit?:number},now=new Date().toISOString()):Promise<ProviderDiscoveryResult>{
  const observations:ProviderDiscoveryObservation[]=[];const warnings:string[]=[]
  for(const adapter of adapters){
    try{observations.push(...await adapter.discover({...input,limit:Math.max(1,Math.min(input.limit??25,100))}))}
    catch(error){warnings.push(`${adapter.id}: ${error instanceof Error?error.message:'provider discovery failed'}`)}
  }
  const result=observationsToFulfillmentProviders(observations,now)
  return {...result,warnings:uniq([...result.warnings,...warnings])}
}
