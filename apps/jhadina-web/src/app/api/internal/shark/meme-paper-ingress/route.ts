import {NextRequest,NextResponse} from 'next/server'
import {authorizedSchedulerRequest} from '@/lib/internal-scheduler-auth'
import {createSchedulerServiceRoleClient} from '@/lib/supabase/service-role'
import {validatePaperIngress,persistPaperIngress} from '@/lib/shark/paper-observation-ingress'

export const runtime='nodejs'
export const dynamic='force-dynamic'

// No GET, no browser client, no personal authorization token in request body.
// Only the exact GitHub production scheduler OIDC workflow may write evidence.
export async function POST(request:NextRequest){
  if(!(await authorizedSchedulerRequest(request)))
    return NextResponse.json({ok:false,error:'unauthorized'},{status:401})
  let rows
  try{
    const raw=await request.text()
    if(!raw||raw.length>240000)return NextResponse.json({ok:false,error:'invalid_length'},{status:413})
    rows=validatePaperIngress(JSON.parse(raw))
  }catch(error){
    console.warn('SHARK paper ingress unsafe or malformed payload',error instanceof Error?error.message:'unknown')
    return NextResponse.json({ok:false,error:'unverified_paper_evidence'},{status:400})
  }
  const client=createSchedulerServiceRoleClient(request)
  if(!client)return NextResponse.json({ok:false,error:'shark_research_storage_unavailable'},{status:503})
  try{
    const result=await persistPaperIngress(client,rows)
    return NextResponse.json({ok:true,...result,realTrades:0,
      verifiedSellability:false,confirmedRugs:0,verifiedRugCountAvailable:false})
  }catch(error){
    console.error('SHARK paper ingress durable receipt failed',error)
    return NextResponse.json({ok:false,error:'paper_evidence_persistence_failed'},{status:502})
  }
}
