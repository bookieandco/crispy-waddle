import type { SupabaseClient } from '@supabase/supabase-js'
import {
  assessBrokerProvider,
  buildPreviousWinFingerprints,
  buildProviderSearchIntents,
  scoreProviderAgainstPreviousWins,
  type BrokerProviderCandidate,
  type BrokerRequirement,
} from '@jhadina/opportunity-core'
import { searchExaCompanyProviders } from '@/lib/money-opportunities/exa-company-provider-source'
import {
  searchConfiguredFsisProviders,
  searchFmcsaProviders,
  shouldSearchFmcsa,
  shouldSearchFsis,
} from '@/lib/money-opportunities/us-food-logistics-provider-sources'

type PackageRow={
  id:string
  requirement:BrokerRequirement
  status:'candidate'|'review_required'|'blocked'
  provider_discovery_at:string|null
}

type SamProviderRow={
  notice_id:string
  requirement_id:string
  provider_key:string
  provider_name:string
  country:string|null
  uei:string|null
  cage:string|null
  naics_codes:string[]
  score:number|string
  status:string
  sources:string[]
  evidence:unknown
}

type PrimeProfileRow={
  provider_id:string
  provider_name:string
  states:string[]
  naics_codes:string[]
  psc_codes:string[]
  evidence_refs:string[]
}

const key=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
const uniq=(values:string[])=>[...new Set(values.map(v=>v.trim()).filter(Boolean))]

function mergeProviders(pools:BrokerProviderCandidate[][]):BrokerProviderCandidate[]{
  const out:BrokerProviderCandidate[]=[]
  const byKey=new Map<string,BrokerProviderCandidate>()
  for(const pool of pools)for(const provider of pool){
    const identity=provider.id?.trim()||key(provider.legalName)
    const existing=byKey.get(identity)||byKey.get(key(provider.legalName))
    if(!existing){
      const copy:BrokerProviderCandidate={
        ...provider,
        naicsCodes:[...provider.naicsCodes],
        keywords:[...provider.keywords],
        evidence:[...provider.evidence],
      }
      out.push(copy)
      byKey.set(identity,copy)
      byKey.set(key(provider.legalName),copy)
      continue
    }
    existing.naicsCodes=uniq([...existing.naicsCodes,...provider.naicsCodes])
    existing.keywords=uniq([...existing.keywords,...provider.keywords])
    existing.evidence=[...new Map([...existing.evidence,...provider.evidence].map(e=>[e.id,e])).values()]
    existing.awardCount=(existing.awardCount??0)+(provider.awardCount??0)
    existing.country=existing.country??provider.country
  }
  return out
}

function providerKeywords(requirement:BrokerRequirement){
  return uniq([requirement.label,...(requirement.keywords??[])])
}

async function loadPersistedSamProviderPool(
  client:SupabaseClient,
  requirement:BrokerRequirement,
  limit:number,
):Promise<BrokerProviderCandidate[]>{
  const naics=uniq(requirement.naicsCodes??[])
  if(!naics.length)return[]
  const {data,error}=await client
    .from('jhadina_sam_provider_candidates')
    .select('notice_id,requirement_id,provider_key,provider_name,country,uei,cage,naics_codes,score,status,sources,evidence')
    .in('status',['candidate','review_required'])
    .overlaps('naics_codes',naics)
    .order('score',{ascending:false})
    .limit(Math.max(limit,Math.min(limit*3,100)))
    .returns<SamProviderRow[]>()
  if(error)throw new Error(`sam_provider_pool_read_failed:${error.message}`)
  return (data??[]).map(row=>{
    const sources=row.sources??[]
    const source=sources.includes('sam_entity')?'sam_entity':
      sources.includes('sam_award')?'sam_award':
      sources.includes('usaspending')?'usaspending':'manual'
    const rawEvidence=Array.isArray(row.evidence)?row.evidence:[]
    return {
      id:row.uei?`provider:sam:${row.uei}`:`provider:sam-cache:${row.provider_key}`,
      legalName:row.provider_name,
      country:row.country??undefined,
      naicsCodes:uniq(row.naics_codes??[]),
      keywords:[],
      awardCount:rawEvidence.filter(item=>{
        if(!item||typeof item!=='object')return false
        const evidenceSource=String((item as Record<string,unknown>).source??'')
        return evidenceSource==='usaspending'||evidenceSource==='sam_award'
      }).length||undefined,
      evidence:[{
        id:`sam-provider-cache:${row.notice_id}:${row.requirement_id}:${row.provider_key}`,
        source,
        details:{
          persistedSamCandidate:true,
          noticeId:row.notice_id,
          requirementId:row.requirement_id,
          uei:row.uei,
          cage:row.cage,
          originalSources:sources,
          originalEvidence:rawEvidence,
        },
      }],
    }
  })
}

async function discoverForRequirement(client:SupabaseClient,requirement:BrokerRequirement,limit:number){
  const keywords=providerKeywords(requirement)
  const pools:BrokerProviderCandidate[][]=[]
  const errors:string[]=[]

  try{
    const persisted=await loadPersistedSamProviderPool(client,requirement,limit)
    if(persisted.length)pools.push(persisted)
  }catch(error){
    errors.push(error instanceof Error?error.message:'sam_provider_pool_failed')
  }

  if(process.env.EXA_API_KEY?.trim()){
    try{
      pools.push(await searchExaCompanyProviders({
        keywords,
        naicsCodes:requirement.naicsCodes,
        geography:requirement.geography,
        targetCountry:'US',
        limit,
      }))
    }catch(error){
      errors.push(error instanceof Error?error.message:'exa_provider_discovery_failed')
    }
  }

  if(shouldSearchFmcsa(keywords)){
    try{pools.push(await searchFmcsaProviders({keywords,limit}))}
    catch(error){errors.push(error instanceof Error?error.message:'fmcsa_provider_discovery_failed')}
  }

  if(shouldSearchFsis(keywords)){
    try{pools.push(await searchConfiguredFsisProviders({keywords,limit}))}
    catch(error){errors.push(error instanceof Error?error.message:'fsis_provider_discovery_failed')}
  }

  return {providers:mergeProviders(pools),errors}
}

async function markProviderDiscoveryReceipt(client:SupabaseClient,packageId:string,now:string){
  const {error}=await client
    .from('jhadina_public_work_packages')
    .update({provider_discovery_at:now})
    .eq('id',packageId)
  if(error)throw new Error(`public_work_package_provider_receipt_failed:${error.message}`)
}

async function loadPrimeAnchors(client:SupabaseClient){
  const {data,error}=await client
    .from('jhadina_public_prime_profiles')
    .select('provider_id,provider_name,states,naics_codes,psc_codes,evidence_refs')
    .order('award_count',{ascending:false})
    .limit(1000)
    .returns<PrimeProfileRow[]>()
  if(error)throw new Error(`public_prime_profile_anchor_read_failed:${error.message}`)
  return buildPreviousWinFingerprints((data??[]).map(row=>({
    providerId:row.provider_id,
    providerName:row.provider_name,
    naicsCodes:row.naics_codes??[],
    pscCodes:row.psc_codes??[],
    state:row.states?.[0],
    evidenceRefs:row.evidence_refs??[],
  })))
}

export async function discoverPublicWorkPackageProviders(
  client:SupabaseClient,
  input:{batchSize?:number;maxProvidersPerPackage?:number;now?:string}={},
){
  const now=input.now??new Date().toISOString()
  const batchSize=Math.max(1,Math.min(input.batchSize??20,100))
  const maxProviders=Math.max(1,Math.min(input.maxProvidersPerPackage??20,50))
  const {data,error}=await client
    .from('jhadina_public_work_packages')
    .select('id,requirement,status,provider_discovery_at')
    .in('status',['candidate','review_required'])
    .is('provider_discovery_at',null)
    .order('updated_at',{ascending:true})
    .limit(batchSize)
    .returns<PackageRow[]>()
  if(error)throw new Error(`public_work_package_provider_queue_read_failed:${error.message}`)
  if(!data?.length){
    return {status:'IDLE' as const,packages:0,candidates:0,errors:[],providerOutreachAuthorized:false as const}
  }

  const anchors=await loadPrimeAnchors(client)
  let candidateCount=0
  const errors:string[]=[]
  const summaries=[]

  for(const pkg of data){
    const requirement=pkg.requirement
    if(!requirement?.id||!requirement?.label){
      errors.push(`${pkg.id}: invalid BrokerRequirement`)
      await markProviderDiscoveryReceipt(client,pkg.id,now)
      continue
    }
    const {providers,errors:discoveryErrors}=await discoverForRequirement(client,requirement,maxProviders)
    errors.push(...discoveryErrors.map(error=>`${pkg.id}: ${error}`))
    const intent=buildProviderSearchIntents([requirement])[0]
    if(!intent){
      errors.push(`${pkg.id}: provider search intent unavailable`)
      await markProviderDiscoveryReceipt(client,pkg.id,now)
      continue
    }
    const assessed=providers.map(provider=>{
      const similarity=scoreProviderAgainstPreviousWins({
        providerId:provider.id,
        providerName:provider.legalName,
        naicsCodes:provider.naicsCodes,
        pscCodes:[],
        state:requirement.geography?.split(',').at(-1)?.trim(),
        keywords:provider.keywords,
      },anchors)
      const enriched={...provider,previousWinSimilarity:similarity}
      return {provider:enriched,assessment:assessBrokerProvider(intent,enriched)}
    })

    if(assessed.length){
      const rows=assessed.map(({provider,assessment})=>({
        package_id:pkg.id,
        provider_id:provider.id,
        legal_name:provider.legalName,
        country:provider.country??null,
        naics_codes:provider.naicsCodes,
        keywords:provider.keywords,
        award_count:provider.awardCount??null,
        previous_win_similarity:provider.previousWinSimilarity??null,
        evidence:provider.evidence,
        assessment_status:assessment.status,
        score:assessment.score,
        reasons:assessment.reasons,
        evidence_refs:assessment.evidenceRefs,
        discovered_at:now,
        updated_at:now,
      }))
      const {error:persistError}=await client
        .from('jhadina_public_package_provider_candidates')
        .upsert(rows,{onConflict:'package_id,provider_id'})
      if(persistError)throw new Error(`public_work_package_provider_persist_failed:${persistError.message}`)
      candidateCount+=rows.length
    }
    await markProviderDiscoveryReceipt(client,pkg.id,now)

    summaries.push({
      packageId:pkg.id,
      discovered:assessed.length,
      candidate:assessed.filter(row=>row.assessment.status==='candidate').length,
      reviewRequired:assessed.filter(row=>row.assessment.status==='review_required').length,
      blocked:assessed.filter(row=>row.assessment.status==='blocked').length,
    })
  }

  return {
    status:'PROCESSED' as const,
    packages:data.length,
    candidates:candidateCount,
    errors,
    summaries,
    providerOutreachAuthorized:false as const,
    primeContactAuthorized:false as const,
    bidSubmissionAuthorized:false as const,
  }
}
