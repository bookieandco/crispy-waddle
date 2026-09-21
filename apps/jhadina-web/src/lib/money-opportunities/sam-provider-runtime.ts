import type { SupabaseClient } from '@supabase/supabase-js'
import { buildBrokerShortlist, type BrokerProviderCandidate, type BrokerRequirement } from '@jhadina/opportunity-core'
import { getSamApiKey } from './sam-config'

type ExtendedProvider=BrokerProviderCandidate & {_uei?:string;_cage?:string}
const rows=(x:unknown):Record<string,unknown>[]=>Array.isArray(x)?x.filter((v):v is Record<string,unknown>=>Boolean(v&&typeof v==='object')):[]
const text=(v:unknown)=>typeof v==='string'?v.trim():''
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
const key=(name:string)=>name.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,120)
function isoDate(d:Date){return d.toISOString().slice(0,10)}
const isUS=(country?:string)=>!country||['US','USA','UNITEDSTATES','UNITEDSTATESOFAMERICA'].includes(country.toUpperCase().replace(/[^A-Z]/g,''))

async function usaSpendingProviders(naics:string,limit=30):Promise<ExtendedProvider[]>{
  const end=new Date(),start=new Date(Date.UTC(end.getUTCFullYear()-5,end.getUTCMonth(),end.getUTCDate()))
  const response=await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({filters:{time_period:[{start_date:isoDate(start),end_date:isoDate(end)}],award_type_codes:['A','B','C','D'],naics_codes:[naics]},fields:['Award ID','Recipient Name','Recipient UEI','Award Amount','Awarding Agency','Award Description','NAICS Code'],limit:Math.max(1,Math.min(limit,100)),page:1,sort:'Award Amount',order:'desc'}),cache:'no-store',signal:AbortSignal.timeout(20000)})
  if(!response.ok)throw new Error(`USASPENDING_HTTP_${response.status}`)
  const body=await response.json() as Record<string,unknown>
  const grouped=new Map<string,ExtendedProvider>()
  for(const row of rows(body.results)){
    const name=text(row['Recipient Name']);if(!name)continue
    const uei=text(row['Recipient UEI'])
    const k=uei||key(name),existing=grouped.get(k)
    const evidence={id:`usaspending:${text(row['Award ID'])||k}`,source:'usaspending' as const,url:'https://www.usaspending.gov/'}
    if(existing){existing.awardCount=(existing.awardCount??0)+1;existing.evidence.push(evidence);continue}
    grouped.set(k,{id:uei?`provider:sam:${uei}`:`provider:award:${key(name)}`,legalName:name,naicsCodes:[text(row['NAICS Code'])||naics].filter(Boolean),keywords:[text(row['Award Description'])].filter(Boolean),awardCount:1,evidence:[evidence],_uei:uei||undefined})
  }
  return [...grouped.values()]
}

function entityToProvider(entity:Record<string,unknown>,naics:string,index:number):ExtendedProvider|null{
  const registration=obj(entity.entityRegistration)
  const core=obj(entity.coreData)
  const entityInfo=obj(core.entityInformation)
  const physical=obj(core.physicalAddress)
  const assertions=obj(entity.assertions)
  const name=text(registration.legalBusinessName)||text(entity.legalBusinessName)||text(entityInfo.legalBusinessName)||text(entityInfo.entityName)
  if(!name)return null
  const uei=text(registration.ueiSAM)||text(entity.ueiSAM)||text(entity.uniqueEntityId)
  const cage=text(registration.cageCode)||text(entity.cageCode)
  const country=text(physical.countryCode)||text(physical.countryCode3)||text(registration.registrationCountryCode)
  const naicsList=rows(assertions.naicsList).map(x=>text(x.naicsCode)).filter(Boolean)
  const evidenceId=`sam-entity:${uei||cage||key(name)||index+1}`
  return {
    id:uei?`provider:sam:${uei}`:`provider:entity:${key(name)}`,
    legalName:name,
    country:country||undefined,
    naicsCodes:[...new Set([naics,...naicsList].filter(Boolean))],
    keywords:[],
    evidence:[{id:evidenceId,source:'sam_entity',url:'https://sam.gov/'}],
    _uei:uei||undefined,
    _cage:cage||undefined,
  }
}

async function samEntityProviders(naics:string,limit=25):Promise<ExtendedProvider[]>{
  const apiKey=getSamApiKey();if(!apiKey)throw new Error('SAM_GOV_API_KEY is not configured')
  const url=new URL('https://api.sam.gov/entity-information/v3/entities')
  url.searchParams.set('api_key',apiKey)
  url.searchParams.set('naicsCode',naics)
  url.searchParams.set('registrationStatus','A')
  url.searchParams.set('page','0')
  url.searchParams.set('size',String(Math.max(1,Math.min(limit,10))))
  url.searchParams.set('includeSections','entityRegistration,coreData,assertions')
  const response=await fetch(url,{headers:{accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(20000)})
  if(!response.ok)throw new Error(`SAM_ENTITY_HTTP_${response.status}`)
  const body=await response.json() as Record<string,unknown>
  return rows(body.entityData).map((entity,index)=>entityToProvider(entity,naics,index)).filter((x):x is ExtendedProvider=>Boolean(x))
}

async function verifySamEntity(provider:ExtendedProvider):Promise<ExtendedProvider>{
  if(provider.evidence.some(e=>e.source==='sam_entity'))return provider
  const apiKey=getSamApiKey();if(!apiKey)return provider
  const url=new URL('https://api.sam.gov/entity-information/v3/entities')
  url.searchParams.set('api_key',apiKey);url.searchParams.set('legalBusinessName',provider.legalName)
  const response=await fetch(url,{headers:{accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(15000)})
  if(!response.ok)return provider
  const body=await response.json() as Record<string,unknown>
  const parsed=entityToProvider(rows(body.entityData)[0]??{},provider.naicsCodes[0]??'',0)
  if(!parsed)return provider
  return {...provider,id:parsed.id,country:parsed.country||provider.country,naicsCodes:[...new Set([...provider.naicsCodes,...parsed.naicsCodes])],evidence:[...provider.evidence,...parsed.evidence],_uei:parsed._uei||provider._uei,_cage:parsed._cage||provider._cage}
}

function mergeProviders(providers:ExtendedProvider[]):ExtendedProvider[]{
  const grouped=new Map<string,ExtendedProvider>()
  for(const provider of providers){
    const k=provider._uei||key(provider.legalName)
    const existing=grouped.get(k)
    if(!existing){grouped.set(k,{...provider,evidence:[...provider.evidence]});continue}
    existing.awardCount=(existing.awardCount??0)+(provider.awardCount??0)
    existing.naicsCodes=[...new Set([...existing.naicsCodes,...provider.naicsCodes])]
    existing.keywords=[...new Set([...existing.keywords,...provider.keywords])]
    existing.evidence=[...existing.evidence,...provider.evidence.filter(e=>!existing.evidence.some(x=>x.id===e.id))]
    existing.country=existing.country||provider.country
    existing._uei=existing._uei||provider._uei
    existing._cage=existing._cage||provider._cage
  }
  return [...grouped.values()]
}

export async function discoverSamProviders(client:SupabaseClient,noticeIds:string[],maxProvidersPerNotice=20){
  let notices=0,candidates=0
  const errors:string[]=[]
  for(const noticeId of noticeIds){
    const {data:analysis}=await client.from('jhadina_sam_analysis').select('requirements,subcontractability').eq('notice_id',noticeId).maybeSingle()
    const {data:catalog}=await client.from('jhadina_sam_catalog').select('naics_codes').eq('notice_id',noticeId).maybeSingle()
    if(!analysis||!catalog)continue
    const rawReq:Record<string,unknown>[]=Array.isArray((analysis as Record<string,unknown>).requirements)?((analysis as Record<string,unknown>).requirements as Record<string,unknown>[]):[]
    const naics=Array.isArray((catalog as Record<string,unknown>).naics_codes)?((catalog as Record<string,unknown>).naics_codes as string[]):[]
    const requirements:BrokerRequirement[]=rawReq.length?rawReq.map((req,i)=>({id:text(req.id)||`${noticeId}:req:${i+1}`,label:text(req.label)||'contract requirement',naicsCodes:Array.isArray(req.naicsCodes)?req.naicsCodes.filter((x):x is string=>typeof x==='string'):naics,keywords:Array.isArray(req.keywords)?req.keywords.filter((x):x is string=>typeof x==='string'):[]})):[{id:`${noticeId}:scope`,label:'solicitation scope',naicsCodes:naics}]
    const primaryNaics=naics[0]||requirements.flatMap(req=>req.naicsCodes??[])[0]
    if(!primaryNaics){errors.push(`${noticeId}: no NAICS available for provider discovery`);continue}
    try{
      const [awardResult,entityResult]=await Promise.allSettled([
        usaSpendingProviders(primaryNaics,maxProvidersPerNotice),
        samEntityProviders(primaryNaics,maxProvidersPerNotice),
      ])
      if(awardResult.status==='rejected')errors.push(`${noticeId}: ${awardResult.reason instanceof Error?awardResult.reason.message:'USASpending discovery failed'}`)
      if(entityResult.status==='rejected')errors.push(`${noticeId}: ${entityResult.reason instanceof Error?entityResult.reason.message:'SAM entity discovery failed'}`)
      const awardProviders=awardResult.status==='fulfilled'?awardResult.value:[]
      const entityProviders=entityResult.status==='fulfilled'?entityResult.value:[]
      const verified:ExtendedProvider[]=[]
      for(const provider of awardProviders.slice(0,Math.min(maxProvidersPerNotice,10)))verified.push(await verifySamEntity(provider))
      const pool=mergeProviders([...entityProviders,...verified,...awardProviders.slice(verified.length)])
      if(!pool.length)throw new Error('NO_PROVIDER_EVIDENCE_RETURNED')
      const shortlist=buildBrokerShortlist(requirements,pool)
      const inserts:Array<Record<string,unknown>>=[]
      for(const group of shortlist)for(const assessment of group.candidates.slice(0,maxProvidersPerNotice)){
        const provider=pool.find(x=>x.id===assessment.providerId);if(!provider)continue
        const foreign=!isUS(provider.country)
        inserts.push({
          notice_id:noticeId,requirement_id:group.intent.requirementId,provider_key:provider._uei||key(provider.legalName),
          provider_name:provider.legalName,country:provider.country??null,uei:provider._uei??null,cage:provider._cage??null,
          naics_codes:provider.naicsCodes,score:assessment.score,status:foreign?'review_required':assessment.status,
          sources:[...new Set(provider.evidence.map(e=>e.source))],
          evidence:[...provider.evidence,{id:`broker:${noticeId}:${group.intent.requirementId}:${provider._uei||key(provider.legalName)}`,source:'manual' as const,url:undefined,foreignProviderReviewRequired:foreign}],
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
