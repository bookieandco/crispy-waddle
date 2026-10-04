import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {createServiceRoleClient} from '@/lib/supabase/service-role'
import {requireDirectorProjectAuthority} from '@/lib/director-project-authority'
import {inspectSideHustleDirectorCanary} from '@/lib/opportunities/side-hustle-director-canary'

export async function GET(request:Request){
  try{
    const supabase=await createClient()
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})

    const projectId=new URL(request.url).searchParams.get('projectId')?.trim()??''
    if(!projectId)return NextResponse.json({ok:false,error:'projectId is required'},{status:400})

    const client=createServiceRoleClient()
    if(!client)return NextResponse.json({ok:false,error:'DIRECTOR_PROJECT_STORE_NOT_CONFIGURED'},{status:503})

    await requireDirectorProjectAuthority(client,{projectId,userId:user.id,capability:'read'})
    const receipt=await inspectSideHustleDirectorCanary({client,userId:user.id,projectId})

    return NextResponse.json({
      ok:true,
      receipt,
      finalReady:receipt.productionReadyForSocialProposal,
      authority:'DIRECTOR_BUSINESS_CANARY_READ_ONLY',
      canGenerate:false,
      canApprove:false,
      canPublish:false,
      canSpend:false,
    })
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_BUSINESS_CANARY_READ_FAILED'
    const status=/ACCESS_DENIED|CAPABILITY_DENIED/.test(message)?403:/NOT_FOUND/.test(message)?404:500
    return NextResponse.json({ok:false,error:message},{status})
  }
}
