import { NextRequest,NextResponse } from 'next/server'
import type { CommercialAcceptanceReceipt,CommercialDeliveryReceipt } from '@jhadina/opportunity-core'
import { reviewPaidPilotEvidence } from '@jhadina/opportunity-core'
import { createClient } from '@/lib/supabase/server'
import { createSupabaseOpportunityRepository } from '@/lib/opportunities/supabase-opportunity-repository'

export const dynamic='force-dynamic'
export const runtime='nodejs'

/** Read-only evidence checklist. Not a payout ledger, receipt factory, or acceptance mutation. */
export async function GET(request:NextRequest) {
  const supabase=await createClient()
  const { data:{user},error }=await supabase.auth.getUser()
  if(error || !user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})
  const workOrderId=request.nextUrl.searchParams.get('workOrderId')?.trim()
  if(!workOrderId || workOrderId.length>240)return NextResponse.json({ok:false,error:'workOrderId required'},{status:400})
  try {
    const repo=createSupabaseOpportunityRepository()
    const workOrder=await repo.getSideHustleCommercialWorkOrder(workOrderId)
    if(!workOrder)return NextResponse.json({ok:false,error:'Work order not found'},{status:404})
    const stored=await repo.get(workOrder.opportunityId)
    if(!stored || stored.userId!==user.id)return NextResponse.json({ok:false,error:'Work order not found'},{status:404})
    const [deliveryRows,acceptanceRows,outcomes]=await Promise.all([
      repo.listSideHustleCommercialReceipts({workOrderId,kind:'delivery'}),
      repo.listSideHustleCommercialReceipts({workOrderId,kind:'acceptance'}),
      repo.listOutcomes(workOrder.opportunityId),
    ])
    const delivery=deliveryRows[deliveryRows.length-1]?.payload as CommercialDeliveryReceipt|undefined
    const acceptance=acceptanceRows[acceptanceRows.length-1]?.payload as CommercialAcceptanceReceipt|undefined
    const outcome=outcomes.find(o=>o.sourceOwner==='money_core' && o.result==='won')
    const review=reviewPaidPilotEvidence({
      workOrder,delivery,acceptance,outcome,
      moneyVerifiedByIndependentRead:false, // cannot be overridden by request or model output
    })
    return NextResponse.json({
      ok:true,workOrderId,opportunityId:workOrder.opportunityId,
      review,customerAcceptanceEvidencePresent:Boolean(acceptance),
      deliveryEvidencePresent:Boolean(delivery),
      financialReconciliationPending:true,
      externalActionAuthorized:false,
      paidIncomeCertified:false,
    },{headers:{'cache-control':'no-store'}})
  } catch(cause){
    return NextResponse.json({ok:false,error:cause instanceof Error?cause.message:'Commercial review unavailable'},{status:503,headers:{'cache-control':'no-store'}})
  }
}
