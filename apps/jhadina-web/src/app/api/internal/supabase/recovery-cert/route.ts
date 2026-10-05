import {NextRequest,NextResponse} from 'next/server'
import type {SupabaseClient} from '@supabase/supabase-js'
import {authorizedSchedulerRequest} from '@/lib/internal-scheduler-auth'
import {createSchedulerServiceRoleClient} from '@/lib/supabase/service-role'

export const runtime='nodejs'
export const dynamic='force-dynamic'

type ProbeResult=Readonly<{
  id:string
  kind:'table'|'auth'|'storage'|'runtime-config'|'storage-object-sample'
  ready:boolean
  detail:string
}>

const TABLE_PROBES=Object.freeze([
  ['memory','jhadina_memory_candidates'],
  ['director-context','director_project_business_context'],
  ['director-watch','director_watch_jobs'],
  ['director-canary','director_business_canary_receipts'],
  ['sam','jhadina_sam_pursuit_snapshots'],
  ['overage-supabase-edge','tax_live_real_case_acceptance_runs'],
  ['spatial','jhadina_spatial_evidence'],
  ['opportunity','jhadina_opportunities'],
  ['action-audit','jhadina_audit_event'],
  ['money','money_purse_charters'],
] as const)

const RETIRED_DIRECTOR_POD_ID='xn73vwwekavcc6'
const DIRECTOR_RUNTIME_CONFIG_KEYS=Object.freeze([
  'director_hunyuan_worker_url',
  'director_speaker_qc_url',
  'director_bonez_voice_runtime_url',
])

async function tableProbe(client:SupabaseClient,id:string,table:string):Promise<ProbeResult>{
  const {error}=await client.from(table).select('*',{head:true,count:'estimated'}).limit(1)
  return Object.freeze({
    id,
    kind:'table',
    ready:!error,
    detail:error?String(error.message||error.code||'table probe failed'):'reachable',
  })
}

async function authProbe(client:SupabaseClient):Promise<ProbeResult>{
  const {error}=await client.auth.admin.listUsers({page:1,perPage:1})
  return Object.freeze({
    id:'auth-admin',
    kind:'auth',
    ready:!error,
    detail:error?String(error.message||'auth admin probe failed'):'reachable',
  })
}

async function storageProbe(client:SupabaseClient):Promise<{
  probe:ProbeResult
  buckets:readonly string[]
}>{
  const {data,error}=await client.storage.listBuckets()
  if(error){
    return {
      probe:Object.freeze({
        id:'storage-api',
        kind:'storage',
        ready:false,
        detail:String(error.message||'storage probe failed'),
      }),
      buckets:Object.freeze([]),
    }
  }
  const buckets=Object.freeze((data??[]).map(bucket=>bucket.name).sort())
  return {
    probe:Object.freeze({
      id:'storage-api',
      kind:'storage',
      ready:true,
      detail:'reachable',
    }),
    buckets,
  }
}

async function runtimeConfigProbe(client:SupabaseClient):Promise<ProbeResult>{
  const {data,error}=await client
    .from('director_runtime_config')
    .select('key,value,sensitive')
    .in('key',[...DIRECTOR_RUNTIME_CONFIG_KEYS])
  if(error){
    return Object.freeze({
      id:'director-runtime-config',
      kind:'runtime-config',
      ready:false,
      detail:String(error.message||'runtime config probe failed'),
    })
  }
  const rows=(data??[]) as Array<{key?:unknown;value?:unknown;sensitive?:unknown}>
  const referencesRetiredPod=rows.some(row=>
    typeof row.value==='string'&&row.value.includes(RETIRED_DIRECTOR_POD_ID)
  )
  const configured=rows
    .filter(row=>typeof row.key==='string'&&typeof row.value==='string'&&row.value.trim())
    .map(row=>String(row.key))
    .sort()
  return Object.freeze({
    id:'director-runtime-config',
    kind:'runtime-config',
    ready:!referencesRetiredPod,
    detail:referencesRetiredPod
      ?'retired Director RunPod id is still referenced'
      :`configured keys: ${configured.join(',')||'none'}`,
  })
}

function splitObjectPath(value:string):{prefix:string;name:string}{
  const index=value.lastIndexOf('/')
  return index<0
    ?{prefix:'',name:value}
    :{prefix:value.slice(0,index),name:value.slice(index+1)}
}

async function directorStorageObjectSampleProbe(
  client:SupabaseClient,
  bucketNames:readonly string[],
):Promise<ProbeResult>{
  const requiredBuckets=['director-media','director-character-references']
  const missingBuckets=requiredBuckets.filter(name=>!bucketNames.includes(name))
  if(missingBuckets.length){
    return Object.freeze({
      id:'director-storage-object-sample',
      kind:'storage-object-sample',
      ready:false,
      detail:`missing buckets: ${missingBuckets.join(',')}`,
    })
  }

  const {data,error}=await client
    .from('director_reference_media_assets')
    .select('id,bucket_id,object_path')
    .order('admitted_at',{ascending:false})
    .limit(12)
  if(error){
    return Object.freeze({
      id:'director-storage-object-sample',
      kind:'storage-object-sample',
      ready:false,
      detail:String(error.message||'Director reference metadata probe failed'),
    })
  }

  const rows=(data??[]) as Array<{id?:unknown;bucket_id?:unknown;object_path?:unknown}>
  const missing:string[]=[]
  for(const row of rows){
    const bucket=typeof row.bucket_id==='string'?row.bucket_id:''
    const path=typeof row.object_path==='string'?row.object_path:''
    if(!bucket||!path){
      missing.push(String(row.id??'unknown')+':metadata-incomplete')
      continue
    }
    const {prefix,name}=splitObjectPath(path)
    const listed=await client.storage.from(bucket).list(prefix,{limit:20,search:name})
    if(listed.error){
      missing.push(String(row.id??path)+':storage-error')
      continue
    }
    if(!(listed.data??[]).some(entry=>entry.name===name)){
      missing.push(String(row.id??path)+':object-missing')
    }
  }

  return Object.freeze({
    id:'director-storage-object-sample',
    kind:'storage-object-sample',
    ready:missing.length===0,
    detail:missing.length
      ?`sample mismatches: ${missing.slice(0,8).join(',')}`
      :`verified ${rows.length} sampled Director reference objects`,
  })
}

export async function GET(request:NextRequest){
  if(!(await authorizedSchedulerRequest(request))){
    return NextResponse.json({ok:false,error:'unauthorized'},{status:401})
  }

  const client=createSchedulerServiceRoleClient(request)
  if(!client){
    return NextResponse.json({
      ok:false,
      ready:false,
      state:'BLOCKED',
      blocker:'SUPABASE_PRIVILEGED_TRANSPORT_UNAVAILABLE',
      authority:'SUPABASE_RECOVERY_CERT_READ_ONLY',
      canMutate:false,
    },{status:503})
  }

  const tableResults=await Promise.all(
    TABLE_PROBES.map(([id,table])=>tableProbe(client,id,table))
  )
  const [auth,storage,runtimeConfig]=await Promise.all([
    authProbe(client),
    storageProbe(client),
    runtimeConfigProbe(client),
  ])
  const storageObjects=storage.probe.ready
    ?await directorStorageObjectSampleProbe(client,storage.buckets)
    :Object.freeze({
      id:'director-storage-object-sample',
      kind:'storage-object-sample' as const,
      ready:false,
      detail:'storage API unavailable',
    })

  const probes=Object.freeze([
    ...tableResults,
    auth,
    storage.probe,
    runtimeConfig,
    storageObjects,
  ])
  const ready=probes.every(probe=>probe.ready)

  return NextResponse.json({
    ok:ready,
    ready,
    state:ready?'READY':'BLOCKED',
    observedAt:new Date().toISOString(),
    environment:process.env.VERCEL_ENV??'unknown',
    commitSha:process.env.VERCEL_GIT_COMMIT_SHA??process.env.GITHUB_SHA??null,
    authority:'SUPABASE_RECOVERY_CERT_READ_ONLY',
    canMutate:false,
    probes,
    storage:{
      bucketCount:storage.buckets.length,
      requiredDirectorBucketsPresent:
        storage.buckets.includes('director-media')&&
        storage.buckets.includes('director-character-references'),
    },
  },{status:ready?200:503})
}
