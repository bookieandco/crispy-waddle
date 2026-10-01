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

async function discoverForRequirement(requirement:BrokerRequirement,limit:number){
  const keywords=providerKeywords(requirement)
  const pools:BrokerProviderCandidate[][]=[]
  const errors:string[]=[]

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
    .select('id,requirement,status')
    .in('status',['candidate','review_required'])
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
      continue
    }
    const {providers,errors:discoveryErrors}=await discoverForRequirement(requirement,maxProviders)
    errors.push(...discoveryErrors.map(error=>`${pkg.id}: ${error}`))
    const intent=buildProviderSearchIntents([requirement])[0]
    if(!intent)continue
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
