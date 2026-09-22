import type { SupabaseClient } from '@supabase/supabase-js'
import { buildBrokerShortlist, evaluateSamSubcontractability, type BrokerProviderCandidate, type BrokerRequirement, type SubcontractabilityInput } from '@jhadina/opportunity-core'
import { getSamApiKey } from './sam-config'

const rows=(x:unknown):Record<string,unknown>[]=>Array.isArray(x)?x.filter((v):v is Record<string,unknown>=>Boolean(v&&typeof v==='object')):[]
const text=(v:unknown)=>typeof v==='string'?v.trim():''
const key=(name:string)=>name.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,120)
function complianceInput(value:unknown):SubcontractabilityInput|null{
  if(!value||typeof value!=='object')return null
  const root=value as Record<string,unknown>
  const raw=root.evaluationInput
  if(!raw||typeof raw!=='object')return null
  const x=raw as Record<string,unknown>
  const agencyKind=x.agencyKind
  const contractKind=x.contractKind
  const isFood=x.isFood
  const clauses=Array.isArray(x.clauses)?x.clauses.filter((v):v is string=>typeof v==='string'):[]
  if(!['dod','civilian','unknown'].includes(String(agencyKind)))return null
  if(!['service','supply','general_construction','specialty_construction','mixed','unknown'].includes(String(contractKind)))return null
  if(typeof isFood!=='boolean')return null
  return {
    agencyKind:agencyKind as SubcontractabilityInput['agencyKind'],
    contractKind:contractKind as SubcontractabilityInput['contractKind'],
    isFood,
    clauses,
    ...(typeof x.setAside==='string'?{setAside:x.setAside}:{}),
  }
}
function isoDate(d:Date){return d.toISOString().slice(0,10)}
async function usaSpendingProviders(naics:string,limit=30):Promise<BrokerProviderCandidate[]>{
  const end=new Date(),start=new Date(Date.UTC(end.getUTCFullYear()-5,end.getUTCMonth(),end.getUTCDate()))
  const response=await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({filters:{time_period:[{start_date:isoDate(start),end_date:isoDate(end)}],award_type_codes:['A','B','C','D'],naics_codes:[naics]},fields:['Award ID','Recipient Name','Recipient UEI','Award Amount','Awarding Agency','Award Description','NAICS Code'],limit:Math.max(1,Math.min(limit,100)),page:1,sort:'Award Amount',order:'desc'}),cache:'no-store',signal:AbortSignal.timeout(20000)})
  if(!response.ok)throw new Error(`USASPENDING_HTTP_${response.status}`)
  const body=await response.json() as Record<string,unknown>
  const grouped=new Map<string,BrokerProviderCandidate>()
  for(const r of rows(body.results)){
    const name=text(r['Recipient Name']);if(!name)continue
    const k=key(name),existing=grouped.get(k)
    const evidence={id:`usaspending:${text(r['Award ID'])||k}`,source:'usaspending' as const,url:'https://www.usaspending.gov/'}
    if(existing){existing.awardCount=(existing.awardCount??0)+1;existing.evidence.push(evidence);continue}
    grouped.set(k,{id:`provider:award:${k}`,legalName:name,naicsCodes:[text(r['NAICS Code'])||naics].filter(Boolean),keywords:[text(r['Award Description'])].filter(Boolean),awardCount:1,evidence:[evidence]})
  }
  return [...grouped.values()]
}
async function verifySamEntity(provider:BrokerProviderCandidate){
  const apiKey=getSamApiKey();if(!apiKey)return provider
  const url=new URL('https://api.sam.gov/entity-information/v3/entities')
  url.searchParams.set('api_key',apiKey);url.searchParams.set('legalBusinessName',provider.legalName)
  const response=await fetch(url,{headers:{accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(15000)})
  if(!response.ok)return provider
  const body=await response.json() as Record<string,unknown>
  const entity=rows(body.entityData)[0];if(!entity)return provider
  const registration=(entity.entityRegistration&&typeof entity.entityRegistration==='object'?entity.entityRegistration:{}) as Record<string,unknown>
  const core=(entity.coreData&&typeof entity.coreData==='object'?entity.coreData:{}) as Record<string,unknown>
  const address=(core.physicalAddress&&typeof core.physicalAddress==='object'?core.physicalAddress:{}) as Record<string,unknown>
  const uei=text(registration.ueiSAM)||text(entity.ueiSAM)
  const cage=text(registration.cageCode)||text(entity.cageCode)
  const country=text(address.countryCode)||text(address.countryCode3)
  return {...provider,country:country||provider.country,evidence:[...provider.evidence,{id:`sam-entity:${uei||cage||key(provider.legalName)}`,source:'sam_entity' as const,url:'https://sam.gov/'}],...(uei?{id:`provider:sam:${uei}`}:{}) ,_uei:uei,_cage:cage} as BrokerProviderCandidate & {_uei?:string;_cage?:string}
}

export async function discoverSamProviders(client:SupabaseClient,noticeIds:string[],maxProvidersPerNotice=20){
  let notices=0,candidates=0
  const errors:string[]=[]
  for(const noticeId of noticeIds){
    const {data:analysis}=await client.from('jhadina_sam_analysis').select('requirements,subcontractability').eq('notice_id',noticeId).maybeSingle()
    const {data:catalog}=await client.from('jhadina_sam_catalog').select('naics_codes').eq('notice_id',noticeId).maybeSingle()
    if(!analysis||!catalog)continue
    const analysisRow=analysis as Record<string,unknown>
    const rawReq=Array.isArray(analysisRow.requirements)?(analysisRow.requirements as Record<string,unknown>[]):[]
    const complianceBase=complianceInput(analysisRow.subcontractability)
    const naics=Array.isArray((catalog as Record<string,unknown>).naics_codes)?((catalog as Record<string,unknown>).naics_codes as string[]):[]
    const requirements:BrokerRequirement[]=rawReq.length?rawReq.map((r,i)=>({id:text(r.id)||`${noticeId}:req:${i+1}`,label:text(r.label)||'contract requirement',naicsCodes:Array.isArray(r.naicsCodes)?r.naicsCodes.filter((x):x is string=>typeof x==='string'):naics,keywords:Array.isArray(r.keywords)?r.keywords.filter((x):x is string=>typeof x==='string'):[]})):[{id:`${noticeId}:scope`,label:'solicitation scope',naicsCodes:naics}]
    const primaryNaics=naics[0]||requirements.flatMap(r=>r.naicsCodes??[])[0]
    if(!primaryNaics){errors.push(`${noticeId}: no NAICS available for provider discovery`);continue}
    try{
      const awardProviders=await usaSpendingProviders(primaryNaics,maxProvidersPerNotice)
      const verified:BrokerProviderCandidate[]=[]
      for(const p of awardProviders.slice(0,Math.min(maxProvidersPerNotice,10)))verified.push(await verifySamEntity(p))
      const pool=[...verified,...awardProviders.slice(verified.length)]
      const shortlist=buildBrokerShortlist(requirements,pool)
      const inserts:Array<Record<string,unknown>>=[]
      for(const group of shortlist)for(const assessment of group.candidates.slice(0,maxProvidersPerNotice)){
        const p=pool.find(x=>x.id===assessment.providerId);if(!p)continue
        const ext=p as BrokerProviderCandidate & {_uei?:string;_cage?:string}
        const compliance=complianceBase
          ?evaluateSamSubcontractability({...complianceBase,providerCountry:p.country})
          :null
        const finalStatus=compliance?.status==='blocked'
          ?'blocked'
          :compliance&&(compliance.status==='conditional'||compliance.status==='review_required')&&assessment.status==='candidate'
            ?'review_required'
            :assessment.status
        const evidence=compliance
          ?[...p.evidence,{id:`subcontractability:${noticeId}:${key(p.legalName)}`,source:'subcontractability',decision:compliance}]
          :p.evidence
        inserts.push({
          notice_id:noticeId,
          requirement_id:group.intent.requirementId,
          provider_key:key(p.legalName),
          provider_name:p.legalName,
          country:p.country??null,
          uei:ext._uei??null,
          cage:ext._cage??null,
          naics_codes:p.naicsCodes,
          score:assessment.score,
          status:finalStatus,
          sources:p.evidence.map(e=>e.source),
          evidence,
          discovered_at:new Date().toISOString(),
        })
      }
      if(inserts.length){
        const {error}=await client.from('jhadina_sam_provider_candidates').upsert(inserts,{onConflict:'notice_id,requirement_id,provider_key'})
        if(error)throw new Error(error.message)
        candidates+=inserts.length
      }
      notices+=1
    }catch(error){errors.push(`${noticeId}: ${error instanceof Error?error.message:'provider discovery failed'}`)}
  }
  return {notices,candidates,errors}
}
