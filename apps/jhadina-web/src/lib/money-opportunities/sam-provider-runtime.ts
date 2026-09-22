import type { SupabaseClient } from '@supabase/supabase-js'
import { buildBrokerShortlist, evaluateSamSubcontractability, expandProviderTaxonomy, type BrokerProviderCandidate, type BrokerRequirement, type SubcontractabilityInput } from '@jhadina/opportunity-core'
import { getSamApiKey } from './sam-config'
import { searchCanadaImporterProviders, searchConfiguredCanadaOdbusProviders, searchDenueProviders } from './foreign-provider-sources'
import { searchConfiguredFsisProviders, searchFmcsaProviders, shouldSearchFmcsa, shouldSearchFsis } from './us-food-logistics-provider-sources'
import { searchExaCompanyProviders } from './exa-company-provider-source'

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
async function usaSpendingProviders(search:{naicsCodes?:string[];pscCodes?:string[];keywords?:string[]},limit=30):Promise<RuntimeProvider[]>{
  const end=new Date(),start=new Date(Date.UTC(end.getUTCFullYear()-5,end.getUTCMonth(),end.getUTCDate()))
  const filters:Record<string,unknown>={time_period:[{start_date:isoDate(start),end_date:isoDate(end)}],award_type_codes:['A','B','C','D']}
  if(search.naicsCodes?.length)filters.naics_codes={require:search.naicsCodes.slice(0,5)}
  if(search.pscCodes?.length)filters.psc_codes=search.pscCodes.slice(0,5)
  if(search.keywords?.length)filters.keywords=search.keywords.slice(0,3)
  const response=await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({
      filters,
      fields:['Award ID','Recipient Name','Recipient UEI','Award Amount','Awarding Agency','Description','NAICS','PSC'],
      limit:Math.max(1,Math.min(limit,100)),
      page:1,sort:'Award Amount',order:'desc',
    }),
    cache:'no-store',
    signal:AbortSignal.timeout(20000),
  })
  if(!response.ok)throw new Error(`USASPENDING_HTTP_${response.status}`)
  const body=await response.json() as Record<string,unknown>
  const grouped=new Map<string,RuntimeProvider>()
  for(const r of rows(body.results)){
    const name=text(r['Recipient Name']);if(!name)continue
    const uei=text(r['Recipient UEI'])
    const identity=uei?`uei:${uei.toUpperCase()}`:`name:${key(name)}`
    const existing=grouped.get(identity)
    const evidence={id:`usaspending:${text(r['Award ID'])||key(name)}`,source:'usaspending' as const,url:'https://www.usaspending.gov/'}
    const naicsObj=r['NAICS']&&typeof r['NAICS']==='object'?(r['NAICS'] as Record<string,unknown>):{}
    const pscObj=r['PSC']&&typeof r['PSC']==='object'?(r['PSC'] as Record<string,unknown>):{}
    const awardNaics=text(naicsObj.code)||text(r['NAICS Code'])
    const awardPsc=text(pscObj.code)||text(r['PSC Code'])
    const description=text(r['Description'])||text(r['Award Description'])
    if(existing){
      existing.awardCount=(existing.awardCount??0)+1
      existing.evidence.push(evidence)
      if(awardNaics&&!existing.naicsCodes.includes(awardNaics))existing.naicsCodes.push(awardNaics)
      if(description&&!existing.keywords.includes(description))existing.keywords.push(description)
      if(awardPsc&&!existing.keywords.includes(`PSC ${awardPsc}`))existing.keywords.push(`PSC ${awardPsc}`)
      continue
    }
    grouped.set(identity,{
      id:`provider:award:${uei||key(name)}`,
      legalName:name,
      naicsCodes:[awardNaics,...(search.naicsCodes??[])].filter(Boolean),
      keywords:[description,awardPsc?`PSC ${awardPsc}`:''].filter(Boolean),
      awardCount:1,
      evidence:[evidence],
      _uei:uei||undefined,
    })
  }
  return [...grouped.values()]
}
type RuntimeProvider=BrokerProviderCandidate & {_uei?:string;_cage?:string}

async function samEntityRequest(params:Record<string,string>):Promise<Record<string,unknown>>{
  const apiKey=getSamApiKey()
  if(!apiKey)return{}
  const url=new URL('https://api.sam.gov/entity-information/v3/entities')
  url.searchParams.set('api_key',apiKey)
  url.searchParams.set('registrationStatus','A')
  url.searchParams.set('samRegistered','Yes')
  url.searchParams.set('purposeOfRegistrationCode','Z2')
  url.searchParams.set('includeSections','entityRegistration,coreData,assertions')
  url.searchParams.set('sensitivity','public')
  for(const [name,value] of Object.entries(params))url.searchParams.set(name,value)
  const response=await fetch(url,{headers:{accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(20000)})
  if(!response.ok)throw new Error(`SAM_ENTITY_HTTP_${response.status}`)
  return response.json() as Promise<Record<string,unknown>>
}

function parseSamEntities(body:Record<string,unknown>,fallbackNaics:string[]=[]):RuntimeProvider[]{
  const out:RuntimeProvider[]=[]
  for(const entity of rows(body.entityData)){
    const registration=(entity.entityRegistration&&typeof entity.entityRegistration==='object'?entity.entityRegistration:{}) as Record<string,unknown>
    const core=(entity.coreData&&typeof entity.coreData==='object'?entity.coreData:{}) as Record<string,unknown>
    const address=(core.physicalAddress&&typeof core.physicalAddress==='object'?core.physicalAddress:{}) as Record<string,unknown>
    const assertions=(entity.assertions&&typeof entity.assertions==='object'?entity.assertions:{}) as Record<string,unknown>
    const goods=(assertions.goodsAndServices&&typeof assertions.goodsAndServices==='object'?assertions.goodsAndServices:{}) as Record<string,unknown>
    const name=text(registration.legalBusinessName)||text(entity.legalBusinessName)
    if(!name)continue
    const uei=text(registration.ueiSAM)||text(entity.ueiSAM)
    const cage=text(registration.cageCode)||text(entity.cageCode)
    const country=text(address.countryCode)||text(address.countryCode3)
    const registeredNaics=rows(goods.naicsList).map(row=>text(row.naicsCode)).filter(Boolean)
    const registeredPsc=rows(goods.pscList).map(row=>text(row.pscCode)).filter(Boolean)
    const smallBusinessNaics=rows(goods.naicsList).filter(row=>['Y','YES','TRUE'].includes(text(row.sbaSmallBusiness).toUpperCase())).map(row=>text(row.naicsCode)).filter(Boolean)
    out.push({
      id:`provider:sam:${uei||key(name)}`,
      legalName:name,
      country:country||undefined,
      naicsCodes:[...new Set([...registeredNaics,...fallbackNaics])],
      keywords:registeredPsc.map(code=>`PSC ${code}`),
      evidence:[{
        id:`sam-entity:${uei||cage||key(name)}`,
        source:'sam_entity',
        url:'https://sam.gov/',
        details:{
          uei:uei||null,cage:cage||null,registrationStatus:text(registration.registrationStatus)||null,
          registrationPurpose:text(registration.purposeOfRegistrationDesc)||text(registration.purposeOfRegistrationCode)||null,
          smallBusinessNaicsCodes:smallBusinessNaics,pscCodes:registeredPsc,
          cageVerificationSource:'sam_entity_api',directDlaCageAutomation:false,
        },
      }],
      _uei:uei||undefined,
      _cage:cage||undefined,
    })
  }
  return out
}

async function samEntityProvidersByNaics(naics:string,limit=10):Promise<RuntimeProvider[]>{
  return parseSamEntities(await samEntityRequest({naicsCode:naics,page:'0',size:String(Math.max(1,Math.min(limit,10)))}),[naics])
}

async function samEntityProvidersByUei(ueis:string[]):Promise<RuntimeProvider[]>{
  const values=[...new Set(ueis.map(value=>value.trim().toUpperCase()).filter(Boolean))].slice(0,100)
  if(!values.length)return[]
  return parseSamEntities(await samEntityRequest({ueiSAM:values.join('~'),page:'0',size:String(Math.min(values.length,10))}))
}
function evidenceDomain(raw:string){
  const value=raw.trim()
  if(!value)return''
  try{
    const url=new URL(/^https?:\/\//i.test(value)?value:'https://'+value)
    return url.hostname.toLowerCase().replace(/^www\./,'')
  }catch{return''}
}
function providerDomains(provider:RuntimeProvider){
  const domains:string[]=[]
  for(const evidence of provider.evidence){
    if(evidence.source==='web_search'&&evidence.url){
      const domain=evidenceDomain(evidence.url);if(domain)domains.push(domain)
    }
    const details=evidence.details
    if(details&&typeof details==='object'){
      for(const key of ['website','companyWebsite','site']){
        const value=details[key]
        if(typeof value==='string'){
          const domain=evidenceDomain(value);if(domain)domains.push(domain)
        }
      }
    }
  }
  return [...new Set(domains)]
}
export function mergeProviderPools(...pools:RuntimeProvider[][]):RuntimeProvider[]{
  const byUei=new Map<string,RuntimeProvider>()
  const byName=new Map<string,RuntimeProvider>()
  const byDomain=new Map<string,RuntimeProvider>()
  const merged:RuntimeProvider[]=[]
  for(const pool of pools)for(const provider of pool){
    const uei=provider._uei?.toUpperCase()
    const nameKey=key(provider.legalName)
    const domains=providerDomains(provider)
    const domainMatch=domains.map(domain=>byDomain.get(domain)).find(Boolean)
    const existing=(uei?byUei.get(uei):undefined)??domainMatch??byName.get(nameKey)
    if(!existing){
      const copy={...provider,evidence:[...provider.evidence],naicsCodes:[...provider.naicsCodes],keywords:[...provider.keywords]}
      merged.push(copy)
      byName.set(nameKey,copy)
      if(uei)byUei.set(uei,copy)
      for(const domain of domains)byDomain.set(domain,copy)
      continue
    }
    existing.naicsCodes=[...new Set([...existing.naicsCodes,...provider.naicsCodes])]
    existing.keywords=[...new Set([...existing.keywords,...provider.keywords])]
    existing.evidence=[...new Map([...existing.evidence,...provider.evidence].map(e=>[e.id,e])).values()]
    existing.awardCount=(existing.awardCount??0)+(provider.awardCount??0)
    existing.country=existing.country??provider.country
    existing._uei=existing._uei??provider._uei
    existing._cage=existing._cage??provider._cage
    if(existing._uei){existing.id=`provider:sam:${existing._uei}`;byUei.set(existing._uei.toUpperCase(),existing)}
    for(const domain of [...providerDomains(existing),...domains])byDomain.set(domain,existing)
  }
  return merged
}
export async function discoverSamProviders(client:SupabaseClient,noticeIds:string[],maxProvidersPerNotice=20){
  let notices=0,candidates=0
  const errors:string[]=[]
  const requestedEntityBudget=Number(process.env.SAM_ENTITY_REQUEST_BUDGET_PER_ENRICHMENT??2)
  let entityRequestsRemaining=Number.isFinite(requestedEntityBudget)?Math.max(0,Math.min(Math.floor(requestedEntityBudget),10)):2
  const requestedSpendingBudget=Number(process.env.USASPENDING_REQUEST_BUDGET_PER_ENRICHMENT??6)
  let spendingRequestsRemaining=Number.isFinite(requestedSpendingBudget)?Math.max(0,Math.min(Math.floor(requestedSpendingBudget),30)):6
  const requestedDenueBudget=Number(process.env.DENUE_SEARCH_BUDGET_PER_ENRICHMENT??2)
  let denueSearchesRemaining=Number.isFinite(requestedDenueBudget)?Math.max(0,Math.min(Math.floor(requestedDenueBudget),10)):2
  const requestedCanadaBudget=Number(process.env.CANADA_SEARCH_BUDGET_PER_ENRICHMENT??2)
  let canadaSearchesRemaining=Number.isFinite(requestedCanadaBudget)?Math.max(0,Math.min(Math.floor(requestedCanadaBudget),10)):2
  const requestedFmcsaBudget=Number(process.env.FMCSA_SEARCH_BUDGET_PER_ENRICHMENT??2)
  let fmcsaSearchesRemaining=Number.isFinite(requestedFmcsaBudget)?Math.max(0,Math.min(Math.floor(requestedFmcsaBudget),10)):2
  const requestedFsisBudget=Number(process.env.FSIS_SEARCH_BUDGET_PER_ENRICHMENT??2)
  let fsisSearchesRemaining=Number.isFinite(requestedFsisBudget)?Math.max(0,Math.min(Math.floor(requestedFsisBudget),10)):2
  const requestedExaBudget=Number(process.env.EXA_SEARCH_BUDGET_PER_ENRICHMENT??2)
  let exaSearchesRemaining=Number.isFinite(requestedExaBudget)?Math.max(0,Math.min(Math.floor(requestedExaBudget),10)):2
  const requestedForeignExaBudget=Number(process.env.EXA_FOREIGN_CORROBORATION_BUDGET_PER_ENRICHMENT??2)
  let foreignExaSearchesRemaining=Number.isFinite(requestedForeignExaBudget)?Math.max(0,Math.min(Math.floor(requestedForeignExaBudget),10)):2
  const entityNaicsCache=new Map<string,RuntimeProvider[]>()
  const spendingCache=new Map<string,RuntimeProvider[]>()
  const denueCache=new Map<string,RuntimeProvider[]>()
  const canadaCache=new Map<string,RuntimeProvider[]>()
  const fmcsaCache=new Map<string,RuntimeProvider[]>()
  const fsisCache=new Map<string,RuntimeProvider[]>()
  const exaCache=new Map<string,RuntimeProvider[]>()

  for(const noticeId of noticeIds){
    const {data:analysis}=await client.from('jhadina_sam_analysis').select('requirements,subcontractability').eq('notice_id',noticeId).maybeSingle()
    const {data:catalog}=await client.from('jhadina_sam_catalog').select('naics_codes,classification_codes').eq('notice_id',noticeId).maybeSingle()
    if(!analysis||!catalog)continue
    const analysisRow=analysis as Record<string,unknown>
    const rawReq=Array.isArray(analysisRow.requirements)?(analysisRow.requirements as Record<string,unknown>[]):[]
    const complianceBase=complianceInput(analysisRow.subcontractability)
    const noticeNaics=Array.isArray((catalog as Record<string,unknown>).naics_codes)?((catalog as Record<string,unknown>).naics_codes as string[]):[]
    const noticePsc=Array.isArray((catalog as Record<string,unknown>).classification_codes)?((catalog as Record<string,unknown>).classification_codes as string[]):[]
    const requirements:BrokerRequirement[]=rawReq.length?rawReq.map((r,i)=>({
      id:text(r.id)||`${noticeId}:req:${i+1}`,
      label:text(r.label)||'contract requirement',
      naicsCodes:Array.isArray(r.naicsCodes)?r.naicsCodes.filter((x):x is string=>typeof x==='string'):noticeNaics,
      pscCodes:Array.isArray(r.pscCodes)?r.pscCodes.filter((x):x is string=>typeof x==='string'):noticePsc,
      keywords:Array.isArray(r.keywords)?r.keywords.filter((x):x is string=>typeof x==='string'):[],
    })):[{id:`${noticeId}:scope`,label:'solicitation scope',naicsCodes:noticeNaics,pscCodes:noticePsc}]

    try{
      let pool:RuntimeProvider[]=[]
      for(const requirement of requirements){
        const expansion=expandProviderTaxonomy(requirement)
        const requirementPools:RuntimeProvider[][]=[]

        for(const naics of expansion.naicsCodes.slice(0,2)){
          const cacheKey=`naics:${naics}`
          let awards=spendingCache.get(cacheKey)
          if(!awards&&spendingRequestsRemaining>0){
            spendingRequestsRemaining-=1
            awards=await usaSpendingProviders({naicsCodes:[naics]},maxProvidersPerNotice)
            spendingCache.set(cacheKey,awards)
          }
          if(awards)requirementPools.push(awards)

          let entities=entityNaicsCache.get(naics)
          if(!entities&&entityRequestsRemaining>0){
            entityRequestsRemaining-=1
            try{entities=await samEntityProvidersByNaics(naics,10)}
            catch(error){errors.push(`${noticeId}: ${error instanceof Error?error.message:'SAM entity discovery failed'}`);entities=[]}
            entityNaicsCache.set(naics,entities)
          }
          if(entities)requirementPools.push(entities)
        }

        if(expansion.pscCodes.length&&spendingRequestsRemaining>0){
          const keyName=`psc:${expansion.pscCodes.slice(0,2).join(',')}`
          let awards=spendingCache.get(keyName)
          if(!awards){
            spendingRequestsRemaining-=1
            awards=await usaSpendingProviders({pscCodes:expansion.pscCodes.slice(0,2)},maxProvidersPerNotice)
            spendingCache.set(keyName,awards)
          }
          requirementPools.push(awards)
        }

        if(expansion.keywords.length&&spendingRequestsRemaining>0){
          const terms=expansion.keywords.slice(0,2)
          const keyName=`keywords:${terms.join('|').toLowerCase()}`
          let awards=spendingCache.get(keyName)
          if(!awards){
            spendingRequestsRemaining-=1
            awards=await usaSpendingProviders({keywords:terms},maxProvidersPerNotice)
            spendingCache.set(keyName,awards)
          }
          requirementPools.push(awards)
        }

        if(process.env.EXA_API_KEY?.trim()&&expansion.keywords.length&&exaSearchesRemaining>0){
          const terms=expansion.keywords.slice(0,4)
          const cacheKey=`exa:${expansion.naicsCodes.slice(0,2).join(',')}:${terms.join('|').toLowerCase()}:${requirement.geography??''}`
          let providers=exaCache.get(cacheKey)
          if(!providers){
            exaSearchesRemaining-=1
            try{providers=await searchExaCompanyProviders({keywords:terms,naicsCodes:expansion.naicsCodes.slice(0,2),geography:requirement.geography,targetCountry:'US',limit:maxProvidersPerNotice}) as RuntimeProvider[]}
            catch(error){errors.push(`${noticeId}: ${error instanceof Error?error.message:'Exa company discovery failed'}`);providers=[]}
            exaCache.set(cacheKey,providers)
          }
          if(providers.length)requirementPools.push(providers)
        }

        if(expansion.keywords.length&&shouldSearchFmcsa(expansion.keywords)&&fmcsaSearchesRemaining>0){
          const terms=expansion.keywords.slice(0,4)
          const cacheKey=`fmcsa:${terms.join('|').toLowerCase()}`
          let providers=fmcsaCache.get(cacheKey)
          if(!providers){
            fmcsaSearchesRemaining-=1
            try{providers=await searchFmcsaProviders({keywords:terms,limit:maxProvidersPerNotice}) as RuntimeProvider[]}
            catch(error){errors.push(`${noticeId}: ${error instanceof Error?error.message:'FMCSA carrier discovery failed'}`);providers=[]}
            fmcsaCache.set(cacheKey,providers)
          }
          if(providers.length)requirementPools.push(providers)
        }

        if(expansion.keywords.length&&shouldSearchFsis(expansion.keywords)&&fsisSearchesRemaining>0&&process.env.FSIS_MPI_CSV_URL?.trim()){
          const terms=expansion.keywords.slice(0,4)
          const cacheKey=`fsis:${terms.join('|').toLowerCase()}`
          let providers=fsisCache.get(cacheKey)
          if(!providers){
            fsisSearchesRemaining-=1
            try{providers=await searchConfiguredFsisProviders({keywords:terms,limit:maxProvidersPerNotice}) as RuntimeProvider[]}
            catch(error){errors.push(`${noticeId}: ${error instanceof Error?error.message:'FSIS establishment discovery failed'}`);providers=[]}
            fsisCache.set(cacheKey,providers)
          }
          if(providers.length)requirementPools.push(providers)
        }

        if(process.env.INEGI_DENUE_TOKEN?.trim()&&expansion.keywords.length&&denueSearchesRemaining>0){
          const terms=expansion.keywords.slice(0,3)
          const cacheKey=`denue:${terms.join('|').toLowerCase()}`
          let providers=denueCache.get(cacheKey)
          if(!providers){
            denueSearchesRemaining-=1
            try{providers=await searchDenueProviders({keywords:terms,limit:maxProvidersPerNotice}) as RuntimeProvider[]}
            catch(error){errors.push(`${noticeId}: ${error instanceof Error?error.message:'DENUE provider discovery failed'}`);providers=[]}
            denueCache.set(cacheKey,providers)
          }
          if(providers.length){
            requirementPools.push(providers)
            if(process.env.EXA_API_KEY?.trim()&&foreignExaSearchesRemaining>0){
              const exaKey=`exa:MEX:${terms.join('|').toLowerCase()}`
              let webProviders=exaCache.get(exaKey)
              if(!webProviders){
                foreignExaSearchesRemaining-=1
                try{webProviders=await searchExaCompanyProviders({keywords:terms,targetCountry:'MEX',limit:maxProvidersPerNotice}) as RuntimeProvider[]}
                catch(error){errors.push(`${noticeId}: ${error instanceof Error?error.message:'Mexico web corroboration failed'}`);webProviders=[]}
                exaCache.set(exaKey,webProviders)
              }
              if(webProviders.length)requirementPools.push(webProviders)
            }
          }
        }

        if(expansion.keywords.length&&canadaSearchesRemaining>0){
          const terms=expansion.keywords.slice(0,3)
          const cacheKey=`canada:${expansion.naicsCodes.slice(0,2).join(',')}:${terms.join('|').toLowerCase()}`
          let providers=canadaCache.get(cacheKey)
          if(!providers){
            canadaSearchesRemaining-=1
            const discovered:RuntimeProvider[]=[]
            try{
              discovered.push(...await searchCanadaImporterProviders({keywords:terms,limit:maxProvidersPerNotice}) as RuntimeProvider[])
            }catch(error){errors.push(`${noticeId}: ${error instanceof Error?error.message:'Canadian importer discovery failed'}`)}
            try{
              discovered.push(...await searchConfiguredCanadaOdbusProviders({keywords:terms,naicsCodes:expansion.naicsCodes.slice(0,2),limit:maxProvidersPerNotice}) as RuntimeProvider[])
            }catch(error){errors.push(`${noticeId}: ${error instanceof Error?error.message:'Statistics Canada business discovery failed'}`)}
            providers=mergeProviderPools(discovered)
            canadaCache.set(cacheKey,providers)
          }
          if(providers.length){
            requirementPools.push(providers)
            if(process.env.EXA_API_KEY?.trim()&&foreignExaSearchesRemaining>0){
              const exaKey=`exa:CAN:${expansion.naicsCodes.slice(0,2).join(',')}:${terms.join('|').toLowerCase()}`
              let webProviders=exaCache.get(exaKey)
              if(!webProviders){
                foreignExaSearchesRemaining-=1
                try{webProviders=await searchExaCompanyProviders({keywords:terms,naicsCodes:expansion.naicsCodes.slice(0,2),targetCountry:'CAN',limit:maxProvidersPerNotice}) as RuntimeProvider[]}
                catch(error){errors.push(`${noticeId}: ${error instanceof Error?error.message:'Canada web corroboration failed'}`);webProviders=[]}
                exaCache.set(exaKey,webProviders)
              }
              if(webProviders.length)requirementPools.push(webProviders)
            }
          }
        }

        pool=mergeProviderPools(pool,...requirementPools)
      }

      const awardUeis=pool.map(provider=>provider._uei).filter((value):value is string=>Boolean(value))
      if(awardUeis.length&&entityRequestsRemaining>0){
        entityRequestsRemaining-=1
        try{pool=mergeProviderPools(pool,await samEntityProvidersByUei(awardUeis))}
        catch(error){errors.push(`${noticeId}: ${error instanceof Error?error.message:'SAM entity verification failed'}`)}
      }

      if(!pool.length){errors.push(`${noticeId}: no providers found within current source budgets`);continue}
      const shortlist=buildBrokerShortlist(requirements,pool)
      const inserts:Array<Record<string,unknown>>=[]
      for(const group of shortlist)for(const assessment of group.candidates.slice(0,maxProvidersPerNotice)){
        const p=pool.find(x=>x.id===assessment.providerId);if(!p)continue
        const ext=p as RuntimeProvider
        const compliance=complianceBase?evaluateSamSubcontractability({...complianceBase,providerCountry:p.country}):null
        const finalStatus=compliance?.status==='blocked'?'blocked':compliance&&(compliance.status==='conditional'||compliance.status==='review_required')&&assessment.status==='candidate'?'review_required':assessment.status
        const evidence=compliance?[...p.evidence,{id:`subcontractability:${noticeId}:${key(p.legalName)}`,source:'subcontractability',decision:compliance}]:p.evidence
        inserts.push({
          notice_id:noticeId,requirement_id:group.intent.requirementId,provider_key:key(p.legalName),provider_name:p.legalName,
          country:p.country??null,uei:ext._uei??null,cage:ext._cage??null,naics_codes:p.naicsCodes,score:assessment.score,status:finalStatus,
          sources:p.evidence.map(e=>e.source),evidence,discovered_at:new Date().toISOString(),
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
  return {notices,candidates,errors,remainingBudgets:{samEntity:entityRequestsRemaining,usaspending:spendingRequestsRemaining,exa:exaSearchesRemaining,exaForeign:foreignExaSearchesRemaining,fmcsa:fmcsaSearchesRemaining,fsis:fsisSearchesRemaining,denue:denueSearchesRemaining,canada:canadaSearchesRemaining}}
}
