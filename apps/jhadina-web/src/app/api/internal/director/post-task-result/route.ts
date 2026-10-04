import {NextResponse} from 'next/server'
import {createServiceRoleClient} from '@/lib/supabase/service-role'
import {reconcileSideHustleDirectorPostTaskResult} from '@/lib/opportunities/side-hustle-director-post-result'

export const runtime='nodejs'
export const dynamic='force-dynamic'

export async function POST(request:Request){
  const secret=process.env.DIRECTOR_API_SECRET
  if(!secret||request.headers.get('authorization')!=='Bearer '+secret){
    return NextResponse.json({ok:false,error:'unauthorized'},{status:401})
  }

  try{
    const client=createServiceRoleClient()
    if(!client){
      return NextResponse.json({ok:false,error:'DIRECTOR_PROJECT_STORE_NOT_CONFIGURED'},{status:503})
    }
    const body=await request.json() as Parameters<typeof reconcileSideHustleDirectorPostTaskResult>[1]
    const receipt=await reconcileSideHustleDirectorPostTaskResult(client,body)
    return NextResponse.json({ok:true,receipt},{status:201})
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_POST_RESULT_RECONCILIATION_FAILED'
    const status=
      /NOT_FOUND/.test(message)?404:
      /REQUIRED|INVALID|MISMATCH|CONFLICT|STATE/.test(message)?409:
      500
    return NextResponse.json({ok:false,error:message},{status})
  }
}
