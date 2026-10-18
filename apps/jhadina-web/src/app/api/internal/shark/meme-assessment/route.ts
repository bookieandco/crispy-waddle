import {NextRequest,NextResponse} from 'next/server'
import {authorizedSchedulerRequest} from '@/lib/internal-scheduler-auth'
import {createSchedulerServiceRoleClient} from '@/lib/supabase/service-role'
import {validateScheduledMemeAssessment} from '@/lib/shark/meme-assessment-dispatch'
import {runMemeAssessmentCycle} from '@/lib/shark/meme-assessment-worker'

export const runtime='nodejs'
export const dynamic='force-dynamic'

// A trusted upstream producer must submit a complete, sourced assessment.
// This route is intentionally disabled until its scheduler/producer and
// durable database have been separately commissioned. No GET/cron can invent
// missing rug, wallet, liquidity, or actor evidence.
export async function POST(request:NextRequest){
  if(!(await authorizedSchedulerRequest(request)))
    return NextResponse.json({ok:false,error:'unauthorized'},{status:401})
  if(process.env.SHARK_MEME_ASSESSMENT_INGRESS_ENABLED!=='YES')
    return NextResponse.json({ok:false,error:'shark_meme_ingress_not_commissioned'},{status:503})
  const client=createSchedulerServiceRoleClient(request)
  if(!client)
    return NextResponse.json({ok:false,error:'shark_meme_storage_unavailable'},{status:503})
  try{
    const raw=await request.text()
    if(raw.length>256_000)
      return NextResponse.json({ok:false,error:'payload_too_large'},{status:413})
    const now=new Date().toISOString()
    const input=validateScheduledMemeAssessment(JSON.parse(raw),now)
    // FINISH.07 is paper/shadow only. A LIVE_GOVERNED_INTENTS charter
    // must never enter this ingestion path, even if the sender has OIDC.
    const {data:charter,error:charterError}=await client
      .from('money_purse_charters')
      .select('autonomy_mode,effective_at,expires_at')
      .eq('user_id',input.userId)
      .lte('effective_at',now)
      .order('effective_at',{ascending:false})
      .limit(1)
      .maybeSingle()
    if(charterError||!charter||(
      charter.autonomy_mode!=='PAPER_AUTONOMOUS'
      && charter.autonomy_mode!=='SHADOW_AUTONOMOUS'
    )||(charter.expires_at&&charter.expires_at<=now))
      return NextResponse.json({ok:false,error:'paper_shadow_charter_required'},{status:409})
    const result=await runMemeAssessmentCycle({...input,client})
    return NextResponse.json({
      ok:true,assessmentId:result.assessment.assessmentId,
      envelopeId:result.envelope.envelopeId,
      assessmentPersistence:result.persistence,
      runtimeIngress:result.runtimeIngress,
      authority:'INTELLIGENCE_ONLY',canAuthorizeTrade:false,canExecute:false,
    })
  }catch(error){
    console.error('SHARK scheduled meme assessment rejected',error)
    return NextResponse.json({ok:false,error:'shark_meme_assessment_rejected'},{status:422})
  }
}
