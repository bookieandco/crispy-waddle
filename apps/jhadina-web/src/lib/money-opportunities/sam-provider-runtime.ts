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
type RuntimeProvider=BrokerProviderCandidate & {_uei?:string;_cage?:string}

async function samEntityProvidersByNaics(naics:string,limit=10):Promise<RuntimeProvider[]>{
  const apiKey=getSamApiKey()
  if(!apiKey)return[]
  const url=new URL('https://api.sam.gov/entity-information/v3/entities')
  url.searchParams.set('api_key',apiKey)
  url.searchParams.set('registrationStatus','A')
  url.searchParams.set('samRegistered','Yes')
  url.searchParams.set('purposeOfRegistrationCode','Z2')
  url.searchParams.set('naicsCode',naics)
  url.searchParams.set('includeSections','entityRegistration,coreData')
  url.searchParams.set('page','0')
  url.searchParams.set('size',String(Math.max(1,Math.min(limit,10))))
  const response=await fetch(url,{headers:{accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(20000)})
  if(!response.ok)throw new Error(`SAM_ENTITY_HTTP_${response.status}`)
  const body=await response.json() as Record<string,unknown>
  const out:RuntimeProvider[]=[]
  for(const entity of rows(body.entityData)){
    const registration=(entity.entityRegistration&&typeof entity.entityRegistration==='object'?entity.entityRegistration:{}) as Record<string,unknown>
    const core=(entity.coreData&&typeof entity.coreData==='object'?entity.coreData:{}) as Record<string,unknown>
    const address=(core.physicalAddress&&typeof core.physicalAddress==='object'?core.physicalAddress:{}) as Record<string,unknown>
    const name=text(registration.legalBusinessName)||text(entity.legalBusinessName)
    if(!name)continue
    const uei=text(registration.ueiSAM)||text(entity.ueiSAM)
    const cage=text(registration.cageCode)||text(entity.cageCode)
    const country=text(address.countryCode)||text(address.countryCode3)
    out.push({
      id:`provider:sam:${uei||key(name)}`,
      legalName:name,
      country:country||undefined,
      naicsCodes:[naics],
      keywords:[],
      evidence:[{id:`sam-entity:${uei||cage||key(name)}`,source:'sam_entity',url:'https://sam.gov/'}],
      _uei:uei||undefined,
      _cage:cage||undefined,
    })
  }
  return out
}

function mergeProviderPools(...pools:RuntimeProvider[][]):RuntimeProvider[]{
  const merged=new Map<string,RuntimeProvider>()
  for(const pool of pools)for(const provider of pool){
    const k=key(provider.legalName)
    const existing=merged.get(k)
    if(!existing){
      merged.set(k,{...provider,evidence:[...provider.evidence],naicsCodes:[...provider.naicsCodes],keywords:[...provider.keywords]})
      continue
    }
    existing.naicsCodes=[...new Set([...existing.naicsCodes,...provider.naicsCodes])]
    existing.keywords=[...new Set([...existing.keywords,...provider.keywords])]
    existing.evidence=[...new Map([...existing.evidence,...provider.evidence].map(e=>[e.id,e])).values()]
    existing.awardCount=(existing.awardCount??0)+(provider.awardCount??0)
    existing.country=existing.country??provider.country
    existing._uei=existing._uei??provider._uei
    existing._cage=existing._cage??provider._cage
    if(existing._uei)existing.id=`provider:sam:${existing._uei}`
  }
  return [...merged.values()]
}

export async function discoverSamProviders(client:SupabaseClient,noticeIds:string[],maxProvidersPerNotice=20){
  let notices=0,candidates=0
  const errors:string[]=[]
  const requestedBudget=Number(process.env.SAM_ENTITY_REQUEST_BUDGET_PER_ENRICHMENT??2)
  let entityRequestsRemaining=Number.isFinite(requestedBudget)?Math.max(0,Math.min(Math.floor(requestedBudget),10)):2
  const entityCache=new Map<string,RuntimeProvider[]>()
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
      const awardProviders=(await usaSpendingProviders(primaryNaics,maxProvidersPerNotice)) as RuntimeProvider[]
      let entityProviders=entityCache.get(primaryNaics)??null
      if(entityProviders===null&&entityRequestsRemaining>0){
        entityRequestsRemaining-=1
        try{
          entityProviders=await samEntityProvidersByNaics(primaryNaics,10)
          entityCache.set(primaryNaics,entityProviders)
        }catch(error){
          errors.push(`${noticeId}: ${error instanceof Error?error.message:'SAM entity discovery failed'}`)
          entityProviders=[]
          entityCache.set(primaryNaics,entityProviders)
        }
      }
      const pool=mergeProviderPools(entityProviders??[],awardProviders)
      const shortlist=buildBrokerShortlist(requirements,pool)
      const inserts:Array<Record<string,unknown>>=[]
      for(const group of shortlist)for(const assessment of group.candidates.slice(0,maxProvidersPerNotice)){
        const p=pool.find(x=>x.id===assessment.providerId);if(!p)continue
        const ext=p as RuntimeProvider
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
