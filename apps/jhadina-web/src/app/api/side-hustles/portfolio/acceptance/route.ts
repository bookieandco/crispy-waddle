import {NextResponse} from 'next/server'
import {
  SIDE_HUSTLE_DEFINITIONS,
  SIDE_HUSTLE_FAMILY_IDS,
  getSideHustleProductionStatus,
  reviewSideHustlePortfolioCommercialEvidence,
  type SideHustleFamily,
} from '@jhadina/opportunity-core'
import {requireRequestIdentity} from '@/lib/auth/request-user'
import {createSupabaseOpportunityRepository} from '@/lib/opportunities/supabase-opportunity-repository'
import {createSideHustleCommissioningEvidenceRepository} from '@/lib/opportunities/side-hustle-commissioning-repository'
import {listSideHustleLiveCommissioningRuntime} from '@/lib/opportunities/side-hustle-commissioning-runtime'

export const runtime='nodejs'
export const dynamic='force-dynamic'

/**
 * SH-PORTFOLIO.01–FINAL: owner-authenticated, read-only commissioning audit.
 * No actuation, no mock receipts, no default-to-certified fallback on DB errors.
 */
export async function GET(request:Request){
  const requestId=crypto.randomUUID()
  try {
    await requireRequestIdentity()
    const familyParam=new URL(request.url).searchParams.get('family')
    if(familyParam&&!SIDE_HUSTLE_FAMILY_IDS.includes(familyParam as SideHustleFamily)){
      return NextResponse.json({ok:false,requestId,error:'Invalid Side Hustle family'},
        {status:400,headers:{'cache-control':'no-store'}})
    }
    const families=familyParam
      ? [familyParam as SideHustleFamily]
      : SIDE_HUSTLE_DEFINITIONS.map(f=>f.family)
    const repository=createSupabaseOpportunityRepository()
    const [workOrders,receipts,commissioning]=await Promise.all([
      repository.listSideHustleCommercialWorkOrders(),
      repository.listSideHustleCommercialReceipts({}),
      listSideHustleLiveCommissioningRuntime(
        {family:familyParam as SideHustleFamily|undefined},
        createSideHustleCommissioningEvidenceRepository(),
      ),
    ])
    const byFamily=new Map(commissioning.states.map(row=>[row.family,row]))
    const rows=families.map(family=>{
      const software=getSideHustleProductionStatus(family)
      const live=byFamily.get(family)
      const commercial=reviewSideHustlePortfolioCommercialEvidence({
        family,workOrders,receipts,
      })
      // A user-readable claim or domain receipt is not independent provider
      // attestation. A candidate requires human verification before acceptance.
      const requiresIndependentVerification=commercial.status==='ready_for_independent_verification'
      const reviewStatus=family==='trading_investing_intelligence'
        ? 'not_applicable'
        : requiresIndependentVerification && live?.status==='certified'
          ? 'ready_for_manual_acceptance'
          : 'blocked'
      const blockers=[
        ...(live?.status==='certified'?[]:['Required live commissioning gates are not all verified.']),
        ...commercial.blockers,
      ]
      return {
        family,softwareReadiness:software.readiness,
        commissioningStatus:live?.status??'unverified',
        commercialEvidenceStatus:commercial.status,
        reviewStatus,
        linkedPaidWorkOrderIds:commercial.linkedPaidWorkOrderIds,
        rejectedWorkOrderIds:commercial.rejectedWorkOrderIds,
        liveEvidenceCounts:commercial.live,
        commissioningGates:live?.gates??[],
        blockers,
        nextMilestones:[...software.nextMilestones],
        automaticExperimentAuthorized:false,
        externalActionAuthorized:false,
        moneyMovementAuthorized:false,
        independentlyCertified:false,
      }
    })
    return NextResponse.json({
      ok:true,requestId,evaluatedAt:commissioning.evaluatedAt,
      summary:{
        total:rows.length,
        readyForManualAcceptance:rows.filter(r=>r.reviewStatus==='ready_for_manual_acceptance').length,
        blocked:rows.filter(r=>r.reviewStatus==='blocked').length,
        capabilityOnly:rows.filter(r=>r.reviewStatus==='not_applicable').length,
        independentlyCertified:0,
      },
      rows,readOnly:true,externalActionAuthorized:false,moneyMovementAuthorized:false,
    },{headers:{'cache-control':'no-store'}})
  } catch(error){
    const message=error instanceof Error?error.message:'Unavailable'
    const auth=/Authenticated|identity|session/i.test(message)
    return NextResponse.json({
      ok:false,requestId,error:auth?'Authentication required':'PORTFOLIO_STORAGE_UNVERIFIED',
      reviewStatus:'blocked',independentlyCertified:false,
      externalActionAuthorized:false,moneyMovementAuthorized:false,
    },{status:auth?401:503,headers:{'cache-control':'no-store'}})
  }
}
