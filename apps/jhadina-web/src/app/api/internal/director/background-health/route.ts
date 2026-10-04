import {NextRequest,NextResponse} from 'next/server'
import {authorizedDirectorBackgroundRequest} from '@/lib/internal-scheduler-auth'

export const runtime='nodejs'
export const dynamic='force-dynamic'

export async function GET(request:NextRequest){
  if(!(await authorizedDirectorBackgroundRequest(request))){
    return NextResponse.json({ok:false,error:'unauthorized'},{status:401})
  }
  return NextResponse.json({
    ok:true,
    environment:process.env.VERCEL_ENV??'unknown',
    commitSha:process.env.VERCEL_GIT_COMMIT_SHA??process.env.GITHUB_SHA??null,
    configuration:{
      hasSupabaseUrl:Boolean(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL),
      hasSupabaseServiceRoleKey:Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      hasWatchWorkerUrl:Boolean(process.env.JHADINA_DIRECTOR_WATCH_WORKER_URL),
      hasWatchWorkerToken:Boolean(process.env.JHADINA_DIRECTOR_WATCH_WORKER_TOKEN),
      hasWatchCallbackUrl:Boolean(process.env.JHADINA_DIRECTOR_WATCH_CALLBACK_URL),
      hasWatchCallbackSecret:Boolean(process.env.JHADINA_DIRECTOR_WATCH_CALLBACK_SECRET),
    },
    authority:'DIRECTOR_BACKGROUND_HEALTH_ONLY',
  })
}
