import {NextRequest,NextResponse} from 'next/server'
import {authorizedDirectorBackgroundRequest} from '@/lib/internal-scheduler-auth'
import {createSchedulerServiceRoleClient} from '@/lib/supabase/service-role'
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

  const client=createSchedulerServiceRoleClient(request)
  if(!client){
    return NextResponse.json({
      ok:false,
      error:'DIRECTOR_BACKGROUND_STORAGE_NOT_CONFIGURED',
      ...common,
      storageReady:false,
    },{status:503})
  }

  try{
    // Only genuine read-only table probes can establish Director storage readiness.
    const [contextProbe,watchProbe]=await Promise.all([
      client.from('director_project_business_context').select('project_id',{head:true,count:'exact'}).limit(1),
      client.from('director_watch_jobs').select('id',{head:true,count:'exact'}).limit(1),
    ])
    const storageError=contextProbe.error??watchProbe.error
    if(storageError){
      return NextResponse.json({
        ok:false,
        error:classifyDirectorBackgroundStorageBlocker(storageError),
        ...common,
        storageReady:false,
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
    },{status:503})
  }

  return NextResponse.json({
    ok:true,
    ...common,
    storageReady:true,
  })
}
