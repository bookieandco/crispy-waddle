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

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || 'https://kqbkaozfjubkjevdfvic.supabase.co'
const OIDC_AUDIENCE = 'jhadina-production-scheduler'
const STATE_MAX_MS = Math.max(
  5 * 60_000,
  Math.min(Number(process.env.LOCAL_GOV_CONVERGENCE_STATE_MAX_MS || 50 * 60_000), 52 * 60_000),
)
const SOURCE_MAX_RUNS = 220
const ADAPTER_MAX_RUNS = 240

type Mode = 'bootstrap' | 'state' | 'finalize'

function usage(){
  console.log([
    'Local government production convergence',
    '',
    'Usage:',
    '  local-gov-production-convergence.ts bootstrap',
    '  local-gov-production-convergence.ts state --state CA',
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
  if(!['bootstrap','state','finalize'].includes(raw))throw new Error(`LOCAL_GOV_CONVERGENCE_MODE_INVALID:${raw}`)
  const mode=raw as Mode
  const stateIndex=process.argv.indexOf('--state')
  const rawState=stateIndex>=0?process.argv[stateIndex+1]?.trim().toUpperCase():undefined
  const state=rawState&&rawState in US_STATE_NAMES?rawState as UsStateOrDcCode:undefined
  if(mode==='state'&&!state)throw new Error('LOCAL_GOV_CONVERGENCE_STATE_REQUIRED')
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
  const query=configure(client.from(table).select('id',{count:'exact',head:true}))
  const {count,error}=await query
  if(error)throw new Error(`LOCAL_GOV_COUNT_FAILED:${table}:${error.message}`)
  return count??0
}

async function sourceRemaining(client:SupabaseClient,state:UsStateOrDcCode){
  return exactCount(client,'jhadina_public_source_discovery_jobs',query=>
    query.eq('state_code',state).in('status',['pending','discovered']),
  )
}

async function adapterRemaining(client:SupabaseClient,state:UsStateOrDcCode){
  return exactCount(client,'jhadina_public_procurement_sources',query=>
    query.eq('state_code',state).eq('adapter_status','adapter_required'),
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

async function runState(client:SupabaseClient,state:UsStateOrDcCode){
  const started=Date.now()
  const sourceDeadline=started+Math.floor(STATE_MAX_MS*0.68)
  let sourceRuns=0
  let sourceProcessed=0
  let verifiedSources=0
  let sourceErrors=0

  while(sourceRuns<SOURCE_MAX_RUNS&&Date.now()<sourceDeadline){
    const result=await commissionPublicProcurementSourceBatch(client,{
      state,
      batchSize:100,
      concurrency:10,
    })
    sourceRuns+=1
    sourceProcessed+=result.processed
    verifiedSources+=result.verifiedSources
    sourceErrors+=result.retryableErrors
    if(result.status==='IDLE')break
  }

  const remainingSources=await sourceRemaining(client,state)
  let adapterRuns=0
  let adapterProcessed=0
  let activated=0
  const adapterDeadline=started+STATE_MAX_MS

  while(adapterRuns<ADAPTER_MAX_RUNS&&Date.now()<adapterDeadline){
    const result=await runPublicAdapterShadowBatch(client,{
      state,
      batchSize:25,
      convergence:true,
    })
    adapterRuns+=1
    adapterProcessed+=result.processed
    activated+=result.activated
    if(result.status==='IDLE')break
  }

  const remainingAdapters=await adapterRemaining(client,state)
  console.log(JSON.stringify({
    phase:'state',
    state,
    elapsedMs:Date.now()-started,
    sources:{
      runs:sourceRuns,
      processed:sourceProcessed,
      verified:verifiedSources,
      retryableErrors:sourceErrors,
      remaining:remainingSources,
      exhausted:remainingSources===0,
    },
    adapters:{
      runs:adapterRuns,
      processed:adapterProcessed,
      activated,
      remaining:remainingAdapters,
      exhausted:remainingAdapters===0,
    },
    externalContactAuthorized:false,
    providerOutreachAuthorized:false,
    bidSubmissionAuthorized:false,
  }))
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
      batchSize:100,
      maxProvidersPerPackage:50,
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
    awards,
    primes,
    packages,
    candidates,
  ]=await Promise.all([
    exactCount(client,'jhadina_public_jurisdictions'),
    exactCount(client,'jhadina_public_source_discovery_jobs',query=>query.in('status',['pending','discovered'])),
    exactCount(client,'jhadina_public_procurement_sources'),
    exactCount(client,'jhadina_public_awards'),
    exactCount(client,'jhadina_public_prime_profiles'),
    exactCount(client,'jhadina_public_work_packages'),
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
      awards,
      primes,
      workPackages:packages,
      packageProviderCandidates:candidates,
    },
    externalContactAuthorized:false,
    providerOutreachAuthorized:false,
    primeContactAuthorized:false,
    bidSubmissionAuthorized:false,
    contractExecutionAuthorized:false,
    paymentAuthorized:false,
  }))
}

async function main(){
  const {mode,state}=parseMode()
  const client=createConvergenceClient()
  if(mode==='bootstrap')return runBootstrap(client)
  if(mode==='state')return runState(client,state!)
  return runFinalize(client)
}

main().catch(error=>{
  console.error(error instanceof Error?error.stack??error.message:String(error))
  process.exitCode=1
})
