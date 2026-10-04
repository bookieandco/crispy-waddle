import {NextRequest,NextResponse} from 'next/server'
import {authorizedDirectorBackgroundRequest} from '@/lib/internal-scheduler-auth'
import {createSchedulerServiceRoleClient} from '@/lib/supabase/service-role'

export const runtime='nodejs'
export const dynamic='force-dynamic'

export async function GET(request:NextRequest){
  if(!(await authorizedDirectorBackgroundRequest(request))){
    return NextResponse.json({ok:false,error:'unauthorized'},{status:401})
  }

  const configuration={
    hasSupabaseUrl:Boolean(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasSupabaseServiceRoleKey:Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    hasWatchWorkerUrl:Boolean(process.env.JHADINA_DIRECTOR_WATCH_WORKER_URL),
    hasWatchWorkerToken:Boolean(process.env.JHADINA_DIRECTOR_WATCH_WORKER_TOKEN),
    hasWatchCallbackUrl:Boolean(process.env.JHADINA_DIRECTOR_WATCH_CALLBACK_URL),
    hasWatchCallbackSecret:Boolean(process.env.JHADINA_DIRECTOR_WATCH_CALLBACK_SECRET),
  }

  const client=createSchedulerServiceRoleClient(request)
  if(!client){
    return NextResponse.json({
      ok:false,
      error:'DIRECTOR_BACKGROUND_STORAGE_NOT_CONFIGURED',
      environment:process.env.VERCEL_ENV??'unknown',
      commitSha:process.env.VERCEL_GIT_COMMIT_SHA??process.env.GITHUB_SHA??null,
      configuration,
      storageReady:false,
      authority:'DIRECTOR_BACKGROUND_HEALTH_ONLY',
    },{status:503})
  }

  const [contextProbe,watchProbe]=await Promise.all([
    client.from('director_project_business_context').select('project_id',{head:true,count:'exact'}).limit(1),
    client.from('director_watch_jobs').select('id',{head:true,count:'exact'}).limit(1),
  ])
  const storageError=contextProbe.error??watchProbe.error
  if(storageError){
    return NextResponse.json({
      ok:false,
      error:'DIRECTOR_BACKGROUND_STORAGE_UNHEALTHY:'+storageError.message,
      environment:process.env.VERCEL_ENV??'unknown',
      commitSha:process.env.VERCEL_GIT_COMMIT_SHA??process.env.GITHUB_SHA??null,
      configuration,
      storageReady:false,
      authority:'DIRECTOR_BACKGROUND_HEALTH_ONLY',
    },{status:503})
  }

  return NextResponse.json({
    ok:true,
    environment:process.env.VERCEL_ENV??'unknown',
    commitSha:process.env.VERCEL_GIT_COMMIT_SHA??process.env.GITHUB_SHA??null,
    configuration,
    storageReady:true,
    authority:'DIRECTOR_BACKGROUND_HEALTH_ONLY',
  })
}
