import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  US_STATE_NAMES,
  type UsStateOrDcCode,
} from '@jhadina/opportunity-core'
import { createOidcSupabaseProxyFetch } from '../src/lib/supabase/service-role'
import { refreshNationalPublicJurisdictions } from '../src/lib/opportunities/public-discovery-runtime'
import { refreshRemainingPublicBuyerRegistries } from '../src/lib/opportunities/public-buyer-registry-runtime'
import { syncDotGovOfficialDomainRegistry } from '../src/lib/opportunities/dotgov-registry-runtime'
import { commissionPublicProcurementSourceBatch } from '../src/lib/opportunities/public-source-commissioning-runtime'
import { runPublicAdapterShadowBatch } from '../src/lib/opportunities/public-adapter-shadow-runtime'
import { minePublicAwardPrimeBatch } from '../src/lib/opportunities/public-award-prime-runtime'
import { discoverPublicWorkPackageProviders } from '../src/lib/opportunities/public-work-package-provider-runtime'
import { buildPublicPrimeCoverageSnapshot } from '../src/lib/opportunities/public-prime-coverage-runtime'
import { refreshUsacPublicVerticalFeeds, type UsacPublicFeed } from '../src/lib/opportunities/public-usac-vertical-runtime'

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || 'https://kqbkaozfjubkjevdfvic.supabase.co'
const OIDC_AUDIENCE = 'jhadina-production-scheduler'
const STATE_MAX_MS = Math.max(
  5 * 60_000,
  Math.min(Number(process.env.LOCAL_GOV_CONVERGENCE_STATE_MAX_MS || 50 * 60_000), 52 * 60_000),
)
const SOURCE_MAX_RUNS = 220
const ADAPTER_MAX_RUNS = 240

type Mode = 'bootstrap' | 'state' | 'state-sources' | 'state-adapters' | 'usac' | 'finalize'

function usage(){
  console.log([
    'Local government production convergence',
    '',
    'Usage:',
    '  local-gov-production-convergence.ts bootstrap',
    '  local-gov-production-convergence.ts state --state CA',
    '  local-gov-production-convergence.ts state-sources --state CA',
    '  local-gov-production-convergence.ts state-adapters --state CA',
    '  local-gov-production-convergence.ts usac',
    '  local-gov-production-convergence.ts finalize',
    '',
    'Requires GitHub Actions id-token:write at runtime.',
  ].join('\n'))
}

function parseMode():{mode:Mode;state?:UsStateOrDcCode}{
  const raw=process.argv[2]
  if(raw==='--help'||raw==='-h'||!raw){
    usage()
    process.exit(0)
  }
  if(!['bootstrap','state','state-sources','state-adapters','usac','finalize'].includes(raw))throw new Error(`LOCAL_GOV_CONVERGENCE_MODE_INVALID:${raw}`)
  const mode=raw as Mode
  const stateIndex=process.argv.indexOf('--state')
  const rawState=stateIndex>=0?process.argv[stateIndex+1]?.trim().toUpperCase():undefined
  const state=rawState&&rawState in US_STATE_NAMES?rawState as UsStateOrDcCode:undefined
  if(['state','state-sources','state-adapters'].includes(mode)&&!state)throw new Error('LOCAL_GOV_CONVERGENCE_STATE_REQUIRED')
  return {mode,state}
}

function jwtExpiryMs(token:string):number{
  try{
    const payload=JSON.parse(Buffer.from(token.split('.')[1]??'','base64url').toString('utf8')) as {exp?:number}
    return typeof payload.exp==='number'?payload.exp*1000:Date.now()+3*60_000
  }catch{
    return Date.now()+3*60_000
  }
}

let cachedOidc:{token:string;expiresAt:number}|undefined

async function githubOidcToken():Promise<string>{
  if(cachedOidc&&cachedOidc.expiresAt-Date.now()>75_000)return cachedOidc.token

  const requestUrl=process.env.ACTIONS_ID_TOKEN_REQUEST_URL?.trim()
  const requestToken=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN?.trim()
  if(requestUrl&&requestToken){
    const url=new URL(requestUrl)
    url.searchParams.set('audience',OIDC_AUDIENCE)
    const response=await fetch(url,{
      headers:{authorization:`Bearer ${requestToken}`,accept:'application/json'},
      cache:'no-store',
    })
    if(!response.ok)throw new Error(`GITHUB_OIDC_TOKEN_HTTP_${response.status}`)
    const body=await response.json() as {value?:string}
    const token=body.value?.trim()
    if(!token)throw new Error('GITHUB_OIDC_TOKEN_EMPTY')
    cachedOidc={token,expiresAt:jwtExpiryMs(token)}
    return token
  }

  const fallback=process.env.JHADINA_GITHUB_OIDC_TOKEN?.trim()
  if(!fallback)throw new Error('GITHUB_OIDC_RUNTIME_UNAVAILABLE')
  cachedOidc={token:fallback,expiresAt:jwtExpiryMs(fallback)}
  return fallback
}

function createConvergenceClient():SupabaseClient{
  return createClient(SUPABASE_URL,'oidc-proxy-placeholder',{
    auth:{autoRefreshToken:false,persistSession:false},
    global:{fetch:createOidcSupabaseProxyFetch(SUPABASE_URL,githubOidcToken)},
  })
}

async function exactCount(
  client:SupabaseClient,
  table:string,
  configure:(query:any)=>any=(query)=>query,
):Promise<number>{
  const delays=[500,1_000,2_000,4_000,8_000,12_000]
  let lastError=''
  for(let attempt=0;attempt<=delays.length;attempt+=1){
    const query=configure(client.from(table).select('*',{count:'exact',head:true}))
    const {count,error}=await query
    if(!error)return count??0
    lastError=error.message||'unknown'
    if(attempt===delays.length)break
    await new Promise(resolve=>setTimeout(resolve,delays[attempt]))
  }
  throw new Error(`LOCAL_GOV_COUNT_FAILED:${table}:${lastError}`)
}

async function sourceRemaining(client:SupabaseClient,state:UsStateOrDcCode){
  return exactCount(client,'jhadina_public_source_discovery_jobs',query=>
    query.eq('state_code',state).in('status',['pending','discovered','deferred']),
  )
}

async function adapterRemaining(client:SupabaseClient,state:UsStateOrDcCode){
  return exactCount(client,'jhadina_public_procurement_sources',query=>
    query.eq('state_code',state).in('adapter_status',['adapter_required','deferred']),
  )
}

async function runBootstrap(client:SupabaseClient){
  const [states,counties,cities,schoolDistricts]=await Promise.all([
    exactCount(client,'jhadina_public_jurisdictions',query=>query.eq('level','state')),
    exactCount(client,'jhadina_public_jurisdictions',query=>query.eq('level','county')),
    exactCount(client,'jhadina_public_jurisdictions',query=>query.eq('level','city')),
    exactCount(client,'jhadina_public_jurisdictions',query=>query.eq('level','school_district')),
  ])
  const baseAdmitted=states===51&&counties>=3140&&cities>=19000&&schoolDistricts>=13000
  const jurisdictions=baseAdmitted
    ?{status:'REUSED' as const,states,counties,cities,schoolDistricts}
    :await refreshNationalPublicJurisdictions(client)
  const registries=await refreshRemainingPublicBuyerRegistries(client)
  const dotgov=await syncDotGovOfficialDomainRegistry(client)
  if(registries.status!=='PASS'){
    throw new Error(`LOCAL_GOV_BUYER_REGISTRY_BOOTSTRAP_PARTIAL:${registries.errors.join('|')}`)
  }
  const totalJurisdictions=await exactCount(client,'jhadina_public_jurisdictions')
  const totalJobs=await exactCount(client,'jhadina_public_source_discovery_jobs')
  console.log(JSON.stringify({
    phase:'bootstrap',
    jurisdictions,
    registries,
    dotgov,
    totalJurisdictions,
    totalJobs,
    externalContactAuthorized:false,
    bidSubmissionAuthorized:false,
  }))
}

async function runStateSources(client:SupabaseClient,state:UsStateOrDcCode){
  const started=Date.now()
  let runs=0
  let processed=0
  let verified=0
  let retryableErrors=0
  while(runs<SOURCE_MAX_RUNS&&Date.now()-started<STATE_MAX_MS){
    const result=await commissionPublicProcurementSourceBatch(client,{
      state,
      batchSize:100,
      concurrency:6,
    })
    runs+=1
    processed+=result.processed
    verified+=result.verifiedSources
    retryableErrors+=result.retryableErrors
    if(result.status==='IDLE')break
  }
  const remaining=await sourceRemaining(client,state)
  const receipt={
    phase:'state-sources',
    state,
    elapsedMs:Date.now()-started,
    runs,
    processed,
    verified,
    retryableErrors,
    remaining,
    exhausted:remaining===0,
    externalContactAuthorized:false,
    bidSubmissionAuthorized:false,
  }
  console.log(JSON.stringify(receipt))
  if(remaining>0)throw new Error(`LOCAL_GOV_SOURCE_CONVERGENCE_INCOMPLETE:${state}:${remaining}`)
  return receipt
}

async function runStateAdapters(client:SupabaseClient,state:UsStateOrDcCode){
  const started=Date.now()
  let runs=0
  let processed=0
  let activated=0
  while(runs<ADAPTER_MAX_RUNS&&Date.now()-started<STATE_MAX_MS){
    const result=await runPublicAdapterShadowBatch(client,{
      state,
      batchSize:25,
      concurrency:5,
      convergence:true,
    })
    runs+=1
    processed+=result.processed
    activated+=result.activated
    if(result.status==='IDLE')break
  }
  const remaining=await adapterRemaining(client,state)
  const receipt={
    phase:'state-adapters',
    state,
    elapsedMs:Date.now()-started,
    runs,
    processed,
    activated,
    remaining,
    exhausted:remaining===0,
    externalContactAuthorized:false,
    providerOutreachAuthorized:false,
    bidSubmissionAuthorized:false,
  }
  console.log(JSON.stringify(receipt))
  if(remaining>0)throw new Error(`LOCAL_GOV_ADAPTER_CONVERGENCE_INCOMPLETE:${state}:${remaining}`)
  return receipt
}

async function runState(client:SupabaseClient,state:UsStateOrDcCode){
  const sources=await runStateSources(client,state)
  const adapters=await runStateAdapters(client,state)
  return {phase:'state',state,sources,adapters}
}

async function runUsac(client:SupabaseClient){
  const started=Date.now()
  const feeds:UsacPublicFeed[]=['erate470Basic','erateFrnStatus','rhcPostedServices','rhcCommitments']
  const years=[new Date().getUTCFullYear(),new Date().getUTCFullYear()-1]
  const summaries=[]
  for(const fundingYear of years){
    const pending=new Set<UsacPublicFeed>(feeds)
    let runs=0
    let fetched=0
    let matched=0
    let observations=0
    while(pending.size&&runs<240&&Date.now()-started<STATE_MAX_MS){
      const result=await refreshUsacPublicVerticalFeeds(client,{
        pageSize:1000,
        fundingYear,
        feeds:[...pending],
      })
      runs+=1
      fetched+=result.fetched
      matched+=result.matched
      observations+=result.observations
      const failures=result.receipts.flatMap(receipt=>receipt.errors.map(error=>`${receipt.feed}:${error}`))
      if(failures.length)throw new Error(`LOCAL_GOV_USAC_FEED_FAILED:${fundingYear}:${failures.join('|')}`)
      for(const feed of result.completedCycles)pending.delete(feed)
    }
    const summary={
      fundingYear,
      runs,
      fetched,
      matched,
      observations,
      remainingFeeds:[...pending],
      exhausted:pending.size===0,
    }
    summaries.push(summary)
    console.log(JSON.stringify({phase:'usac',...summary,externalContactAuthorized:false,bidSubmissionAuthorized:false}))
    if(pending.size)throw new Error(`LOCAL_GOV_USAC_CONVERGENCE_INCOMPLETE:${fundingYear}:${[...pending].join(',')}`)
  }
  return {phase:'usac',summaries}
}

async function runFinalize(client:SupabaseClient){
  const {count:awardInboxCount,error:awardCountError}=await client
    .from('jhadina_public_opportunity_inbox')
    .select('id',{count:'exact',head:true})
    .eq('active',true)
    .eq('stage','award')
  if(awardCountError)throw new Error(`PUBLIC_AWARD_COUNT_FAILED:${awardCountError.message}`)

  let acceptedAwards=0
  let workPackages=0
  const totalAwards=awardInboxCount??0
  for(let offset=0;offset<totalAwards;offset+=500){
    const result=await minePublicAwardPrimeBatch(client,{batchSize:500,offset})
    acceptedAwards+=result.acceptedAwards
    workPackages+=result.workPackages
  }

  let providerRuns=0
  let providerPackages=0
  let providerCandidates=0
  while(providerRuns<200){
    const result=await discoverPublicWorkPackageProviders(client,{
      batchSize:20,
      maxProvidersPerPackage:30,
    })
    providerRuns+=1
    providerPackages+=result.packages
    providerCandidates+=result.candidates
    if(result.status==='IDLE')break
  }

  const coverage=await buildPublicPrimeCoverageSnapshot(client)
  const [
    jurisdictions,
    pendingSourceJobs,
    procurementSources,
    adapterRequiredSources,
    awards,
    primes,
    packages,
    pendingProviderPackages,
    candidates,
  ]=await Promise.all([
    exactCount(client,'jhadina_public_jurisdictions'),
    exactCount(client,'jhadina_public_source_discovery_jobs',query=>query.in('status',['pending','discovered','deferred'])),
    exactCount(client,'jhadina_public_procurement_sources'),
    exactCount(client,'jhadina_public_procurement_sources',query=>query.in('adapter_status',['adapter_required','deferred'])),
    exactCount(client,'jhadina_public_awards'),
    exactCount(client,'jhadina_public_prime_profiles'),
    exactCount(client,'jhadina_public_work_packages'),
    exactCount(client,'jhadina_public_work_packages',query=>
      query.in('status',['candidate','review_required']).is('provider_discovery_at',null),
    ),
    exactCount(client,'jhadina_public_package_provider_candidates'),
  ])

  console.log(JSON.stringify({
    phase:'finalize',
    awardInboxCount:totalAwards,
    acceptedAwards,
    generatedWorkPackages:workPackages,
    providerRuns,
    providerPackages,
    providerCandidates,
    coverage,
    counts:{
      jurisdictions,
      pendingSourceJobs,
      procurementSources,
      adapterRequiredSources,
      awards,
      primes,
      workPackages:packages,
      pendingProviderPackages,
      packageProviderCandidates:candidates,
    },
    externalContactAuthorized:false,
    providerOutreachAuthorized:false,
    primeContactAuthorized:false,
    bidSubmissionAuthorized:false,
    contractExecutionAuthorized:false,
    paymentAuthorized:false,
  }))
  const blockers:string[]=[]
  if(pendingSourceJobs>0)blockers.push(`pending_source_jobs:${pendingSourceJobs}`)
  if(adapterRequiredSources>0)blockers.push(`adapter_required_sources:${adapterRequiredSources}`)
  if(pendingProviderPackages>0)blockers.push(`pending_provider_packages:${pendingProviderPackages}`)
  if(blockers.length)throw new Error(`LOCAL_GOV_PRODUCTION_CONVERGENCE_INCOMPLETE:${blockers.join('|')}`)
}

async function main(){
  const {mode,state}=parseMode()
  const client=createConvergenceClient()
  if(mode==='bootstrap')return runBootstrap(client)
  if(mode==='state')return runState(client,state!)
  if(mode==='state-sources')return runStateSources(client,state!)
  if(mode==='state-adapters')return runStateAdapters(client,state!)
  if(mode==='usac')return runUsac(client)
  return runFinalize(client)
}

main().catch(error=>{
  console.error(error instanceof Error?error.stack??error.message:String(error))
  process.exitCode=1
})
