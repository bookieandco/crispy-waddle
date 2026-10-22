import {NextRequest,NextResponse} from 'next/server'
import {authorizedDirectorBackgroundRequest} from '@/lib/internal-scheduler-auth'
import {createRuntimeServiceRoleClient} from '@/lib/supabase/service-role'
import {getSupabasePublicConfig} from '@/lib/supabase/public-config'
import {
  classifyDirectorBackgroundStorageBlocker,
  directorBackgroundConfiguration,
} from '@/lib/director-background-readiness'

export const runtime='nodejs'
export const dynamic='force-dynamic'

export async function GET(request:NextRequest){
  if(!(await authorizedDirectorBackgroundRequest(request))){
    return NextResponse.json({ok:false,error:'unauthorized'},{status:401})
  }

  let publicSupabaseBootstrap=false
  try{
    // This validates the existing non-secret SWLC publishable bootstrap. It is
    // not evidence that the database, OIDC service proxy, or schema is healthy.
    const publicConfig=getSupabasePublicConfig()
    publicSupabaseBootstrap=Boolean(publicConfig.url&&publicConfig.publishableKey)
  }catch{
    publicSupabaseBootstrap=false
  }
  const bearer=request.headers.get('authorization')??''
  const configuration=directorBackgroundConfiguration({
    directSupabaseUrl:Boolean(process.env.SUPABASE_URL?.trim()||process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()),
    directServiceRoleKey:Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    publicSupabaseBootstrap,
    schedulerBearerIdentity:bearer.startsWith('Bearer ')&&bearer.slice(7).trim().length>0,
    vercelProductionRuntime:process.env.VERCEL_ENV==='production',
    watchWorkerUrl:Boolean(process.env.JHADINA_DIRECTOR_WATCH_WORKER_URL?.trim()),
    watchWorkerToken:Boolean(process.env.JHADINA_DIRECTOR_WATCH_WORKER_TOKEN?.trim()),
    watchCallbackUrl:Boolean(process.env.JHADINA_DIRECTOR_WATCH_CALLBACK_URL?.trim()),
    watchCallbackSecret:Boolean(process.env.JHADINA_DIRECTOR_WATCH_CALLBACK_SECRET?.trim()),
  })
  const common={
    environment:process.env.VERCEL_ENV??'unknown',
    commitSha:process.env.VERCEL_GIT_COMMIT_SHA??process.env.GITHUB_SHA??null,
    configuration,
    authority:'DIRECTOR_BACKGROUND_HEALTH_ONLY' as const,
  }

  // GitHub OIDC authenticates this read-only route; Supabase privileged
  // transport must use Vercel's independently verified production identity.
  // Never forward a Director-scoped GitHub bearer to the generic service proxy.
  const client=await createRuntimeServiceRoleClient()
  if(!client){
    return NextResponse.json({
      ok:false,
      error:'DIRECTOR_BACKGROUND_STORAGE_NOT_CONFIGURED',
      ...common,
      storageReady:false,
      durableRecoveryCertified:false,
    },{status:503})
  }

  try{
    // Require the existing six canonical stores; HEAD probes never certify
    // durable writes, RLS tenant isolation, or an off-host isolated restore.
    const directorTables=[
      'director_project_business_context',
      'director_watch_jobs',
      'director_watch_commissioning_receipts',
      'director_business_canary_receipts',
      'director_local_ugc_canary_receipts',
      'director_workstation_timelines',
    ] as const
    const tableResults=await Promise.all(directorTables.map(table=>
      client.from(table).select('*',{head:true,count:'estimated'}).limit(1)
    ))
    const storageError=tableResults.find(result=>result.error)?.error
    if(storageError){
      return NextResponse.json({
        ok:false,
        error:classifyDirectorBackgroundStorageBlocker(storageError),
        ...common,
        storageReady:false,
        durableRecoveryCertified:false,
      },{status:503})
    }
  }catch{
    // Network or proxy failures can reject instead of yielding PostgREST errors.
    // Never leak raw provider/connection diagnostics or silently authorize work.
    return NextResponse.json({
      ok:false,
      error:'DIRECTOR_BACKGROUND_STORAGE_SERVICE_UNAVAILABLE',
      ...common,
      storageReady:false,
      durableRecoveryCertified:false,
    },{status:503})
  }

  return NextResponse.json({
    ok:true,
    ...common,
    storageReady:true,
    durableRecoveryCertified:false,
  })
}
